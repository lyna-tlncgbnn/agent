import { promises as fs } from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import { z } from "zod";
import { getGatewayRuntimeConfig } from "../config/runtime-config.js";
import { AppError } from "../errors/app-error.js";
import { getLocalFilePolicy, resolveAndAssertPath } from "./local-path-utils.js";

const extractPdfTextArgsSchema = z.object({
  path: z.string().min(1).max(400),
  max_pages: z.coerce.number().int().min(1).max(300).optional()
});

export type ExtractPdfTextArgs = z.infer<typeof extractPdfTextArgsSchema>;

export type ExtractPdfTextResult = {
  path: string;
  totalPages: number;
  returnedPages: number;
  truncated: boolean;
  text: string;
};

export function parseExtractPdfTextArgs(input: unknown): ExtractPdfTextArgs {
  return extractPdfTextArgsSchema.parse(input ?? {});
}

function normalizePdfText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

export async function runExtractPdfText(args: ExtractPdfTextArgs): Promise<{ text: string; data: ExtractPdfTextResult }> {
  const runtime = await getGatewayRuntimeConfig();
  const policy = getLocalFilePolicy(runtime);
  const maxPages = Math.min(args.max_pages ?? policy.maxPdfPages, policy.maxPdfPages);
  const rawPath = args.path.trim();

  let absolutePath: string;

  if (path.isAbsolute(rawPath)) {
    const resolved = resolveAndAssertPath(rawPath, policy);
    absolutePath = resolved.absolutePath;

    let stat;
    try {
      stat = await fs.stat(absolutePath);
    } catch {
      throw new AppError("NOT_FOUND", `PDF 文件不存在: ${args.path}`);
    }

    if (!stat.isFile()) {
      throw new AppError("BAD_REQUEST", `路径不是文件: ${args.path}`);
    }
  } else {
    if (policy.allowedRoots.length === 0) {
      throw new AppError("MISSING_CONFIG", "LOCAL_FILE_ALLOWED_ROOTS 未配置，无法解析相对路径");
    }

    let matchedPath: string | null = null;

    for (const root of policy.allowedRoots) {
      const candidate = path.resolve(root, rawPath);
      try {
        const stat = await fs.stat(candidate);
        if (!stat.isFile()) {
          continue;
        }
        matchedPath = candidate;
        break;
      } catch {
        // ignore and continue to next root
      }
    }

    if (!matchedPath) {
      throw new AppError("NOT_FOUND", `在允许访问的路径中未找到文件: ${args.path}`, {
        allowedRoots: policy.allowedRoots
      });
    }

    absolutePath = matchedPath;
  }

  if (!absolutePath.toLowerCase().endsWith(".pdf")) {
    throw new AppError("BAD_REQUEST", `文件不是 PDF: ${args.path}`);
  }

  const buffer = await fs.readFile(absolutePath);
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();

  const totalPages = parsed.total || 1;
  const returnedPages = Math.min(maxPages, totalPages);
  const truncated = returnedPages < totalPages;

  const pageText = parsed.pages.slice(0, returnedPages).map((item) => item.text).join("\n\n");
  const extractedText = normalizePdfText(pageText || parsed.text || "");

  if (!extractedText) {
    throw new AppError("UNSUPPORTED_CONTENT", "未提取到可用文本，可能是扫描版 PDF（OCR 暂未启用）");
  }

  return {
    text: [
      `PDF 读取成功：${absolutePath}`,
      `页数：${returnedPages}/${totalPages}${truncated ? "（已截断）" : ""}`,
      "",
      extractedText
    ].join("\n"),
    data: {
      path: absolutePath,
      totalPages,
      returnedPages,
      truncated,
      text: extractedText
    }
  };
}
