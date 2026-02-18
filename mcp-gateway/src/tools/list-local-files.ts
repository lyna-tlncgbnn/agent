import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getGatewayRuntimeConfig } from "../config/runtime-config.js";
import { AppError } from "../errors/app-error.js";
import { getLocalFilePolicy, resolveAndAssertPath } from "./local-path-utils.js";

const listLocalFilesArgsSchema = z.object({
  path: z.string().min(1).max(400),
  recursive: z.boolean().optional().default(false),
  max_entries: z.coerce.number().int().min(1).max(5000).optional()
});

export type ListLocalFilesArgs = z.infer<typeof listLocalFilesArgsSchema>;

export type LocalFileListItem = {
  path: string;
  name: string;
  type: "file" | "dir";
  size: number;
  updatedAt: string;
};

export type ListLocalFilesResult = {
  root: string;
  queryPath: string;
  recursive: boolean;
  truncated: boolean;
  count: number;
  items: LocalFileListItem[];
};

export function parseListLocalFilesArgs(input: unknown): ListLocalFilesArgs {
  return listLocalFilesArgsSchema.parse(input ?? {});
}

export async function runListLocalFiles(args: ListLocalFilesArgs): Promise<{ text: string; data: ListLocalFilesResult }> {
  const runtime = await getGatewayRuntimeConfig();
  const policy = getLocalFilePolicy(runtime);
  const maxEntries = Math.min(args.max_entries ?? policy.maxListEntries, policy.maxListEntries);
  const rawPath = args.path.trim();

  let absolutePath: string;
  let allowedRoot: string;

  if (path.isAbsolute(rawPath)) {
    const resolved = resolveAndAssertPath(rawPath, policy);
    absolutePath = resolved.absolutePath;
    allowedRoot = resolved.allowedRoot;

    let rootStat;
    try {
      rootStat = await fs.stat(absolutePath);
    } catch {
      throw new AppError("NOT_FOUND", `路径不存在: ${args.path}`);
    }

    if (!rootStat.isDirectory()) {
      throw new AppError("BAD_REQUEST", `路径不是目录: ${args.path}`);
    }
  } else {
    if (policy.allowedRoots.length === 0) {
      throw new AppError("MISSING_CONFIG", "LOCAL_FILE_ALLOWED_ROOTS 未配置，无法解析相对路径");
    }

    let matchedPath: string | null = null;
    let matchedRoot: string | null = null;

    for (const root of policy.allowedRoots) {
      const candidate = path.resolve(root, rawPath);
      try {
        const stat = await fs.stat(candidate);
        if (!stat.isDirectory()) {
          continue;
        }
        matchedPath = candidate;
        matchedRoot = root;
        break;
      } catch {
        // ignore and continue to next root
      }
    }

    if (!matchedPath || !matchedRoot) {
      throw new AppError("NOT_FOUND", `在允许访问的路径中未找到目录: ${args.path}`, {
        allowedRoots: policy.allowedRoots
      });
    }

    absolutePath = matchedPath;
    allowedRoot = matchedRoot;
  }

  const items: LocalFileListItem[] = [];
  const queue: string[] = [absolutePath];
  let truncated = false;

  while (queue.length > 0 && items.length < maxEntries) {
    const currentDir = queue.shift() as string;
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      const stat = await fs.stat(entryPath);
      const relativePath = path.relative(absolutePath, entryPath) || entry.name;

      items.push({
        path: relativePath,
        name: entry.name,
        type: entry.isDirectory() ? "dir" : "file",
        size: stat.size,
        updatedAt: stat.mtime.toISOString()
      });

      if (entry.isDirectory() && args.recursive) {
        queue.push(entryPath);
      }

      if (items.length >= maxEntries) {
        truncated = true;
        break;
      }
    }
  }

  const lines = [
    `目录：${absolutePath}`,
    `条目数：${items.length}${truncated ? "（已截断）" : ""}`,
    ...items.map((item, index) => `${index + 1}. [${item.type}] ${item.path}`)
  ];

  return {
    text: lines.join("\n"),
    data: {
      root: allowedRoot,
      queryPath: absolutePath,
      recursive: args.recursive,
      truncated,
      count: items.length,
      items
    }
  };
}
