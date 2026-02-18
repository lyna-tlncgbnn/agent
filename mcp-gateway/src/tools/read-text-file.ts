import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getGatewayRuntimeConfig } from "../config/runtime-config.js";
import { AppError } from "../errors/app-error.js";
import { getLocalFilePolicy, resolveAndAssertPath } from "./local-path-utils.js";

const readTextFileArgsSchema = z.object({
  path: z.string().min(1).max(400),
  max_chars: z.coerce.number().int().min(100).max(200000).optional()
});

export type ReadTextFileArgs = z.infer<typeof readTextFileArgsSchema>;

export type ReadTextFileResult = {
  path: string;
  truncated: boolean;
  totalChars: number;
  returnedChars: number;
  content: string;
};

export function parseReadTextFileArgs(input: unknown): ReadTextFileArgs {
  return readTextFileArgsSchema.parse(input ?? {});
}

export async function runReadTextFile(args: ReadTextFileArgs): Promise<{ text: string; data: ReadTextFileResult }> {
  const runtime = await getGatewayRuntimeConfig();
  const policy = getLocalFilePolicy(runtime);
  const maxChars = Math.min(args.max_chars ?? policy.maxReadChars, policy.maxReadChars);
  const rawPath = args.path.trim();

  let absolutePath: string;

  if (path.isAbsolute(rawPath)) {
    const resolved = resolveAndAssertPath(rawPath, policy);
    absolutePath = resolved.absolutePath;

    let stat;
    try {
      stat = await fs.stat(absolutePath);
    } catch {
      throw new AppError("NOT_FOUND", `文件不存在: ${args.path}`);
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

  const contentRaw = await fs.readFile(absolutePath, "utf8");
  const totalChars = contentRaw.length;
  const truncated = totalChars > maxChars;
  const content = truncated ? contentRaw.slice(0, maxChars) : contentRaw;

  return {
    text: `文件读取成功：${absolutePath}\n字符数：${content.length}${truncated ? ` / ${totalChars}（已截断）` : ""}\n\n${content}`,
    data: {
      path: absolutePath,
      truncated,
      totalChars,
      returnedChars: content.length,
      content
    }
  };
}
