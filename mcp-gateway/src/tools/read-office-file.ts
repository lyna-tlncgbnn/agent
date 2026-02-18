import { promises as fs } from "node:fs";
import path from "node:path";
import { parseOffice } from "officeparser";
import { z } from "zod";
import { getGatewayRuntimeConfig } from "../config/runtime-config.js";
import { AppError } from "../errors/app-error.js";
import { getLocalFilePolicy, resolveAndAssertPath } from "./local-path-utils.js";

const readOfficeFileArgsSchema = z.object({
  path: z.string().min(1).max(400),
  max_chars: z.coerce.number().int().min(100).max(200000).optional()
});

const supportedOfficeExtensions = new Set([".docx", ".xlsx", ".pptx"]);

export type ReadOfficeFileArgs = z.infer<typeof readOfficeFileArgsSchema>;

export type ReadOfficeFileResult = {
  path: string;
  format: "docx" | "xlsx" | "pptx";
  truncated: boolean;
  totalChars: number;
  returnedChars: number;
  content: string;
};

export function parseReadOfficeFileArgs(input: unknown): ReadOfficeFileArgs {
  return readOfficeFileArgsSchema.parse(input ?? {});
}

function inferOfficeFormat(absolutePath: string): "docx" | "xlsx" | "pptx" {
  const ext = path.extname(absolutePath).toLowerCase();
  if (ext === ".docx") return "docx";
  if (ext === ".xlsx") return "xlsx";
  return "pptx";
}

export async function runReadOfficeFile(args: ReadOfficeFileArgs): Promise<{ text: string; data: ReadOfficeFileResult }> {
  const runtime = await getGatewayRuntimeConfig();
  const policy = getLocalFilePolicy(runtime);
  const maxChars = Math.min(args.max_chars ?? policy.maxReadChars, policy.maxReadChars);
  const rawPath = args.path.trim();

  let absolutePath: string;

  if (path.isAbsolute(rawPath)) {
    const resolved = resolveAndAssertPath(rawPath, policy);
    absolutePath = resolved.absolutePath;
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

  let stat;
  try {
    stat = await fs.stat(absolutePath);
  } catch {
    throw new AppError("NOT_FOUND", `文件不存在: ${args.path}`);
  }

  if (!stat.isFile()) {
    throw new AppError("BAD_REQUEST", `路径不是文件: ${args.path}`);
  }

  const ext = path.extname(absolutePath).toLowerCase();
  if (!supportedOfficeExtensions.has(ext)) {
    throw new AppError("BAD_REQUEST", `仅支持 docx/xlsx/pptx 文件: ${args.path}`);
  }

  let extracted = "";
  try {
    const ast = await parseOffice(absolutePath, {
      outputErrorToConsole: false,
      extractAttachments: false,
      ocr: false,
      includeRawContent: false
    });
    extracted = ast.toText().replace(/\r\n/g, "\n").trim();
  } catch (error) {
    throw new AppError(
      "UNSUPPORTED_CONTENT",
      `Office 文件解析失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!extracted) {
    throw new AppError("UNSUPPORTED_CONTENT", "未提取到可用文本内容");
  }

  const totalChars = extracted.length;
  const truncated = totalChars > maxChars;
  const content = truncated ? extracted.slice(0, maxChars) : extracted;
  const format = inferOfficeFormat(absolutePath);

  return {
    text: [
      `Office 文件读取成功：${absolutePath}`,
      `格式：${format}`,
      `字符数：${content.length}${truncated ? ` / ${totalChars}（已截断）` : ""}`,
      "",
      content
    ].join("\n"),
    data: {
      path: absolutePath,
      format,
      truncated,
      totalChars,
      returnedChars: content.length,
      content
    }
  };
}
