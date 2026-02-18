import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getGatewayRuntimeConfig } from "../config/runtime-config.js";
import { AppError } from "../errors/app-error.js";
import { getLocalFilePolicy, resolveAndAssertPath } from "./local-path-utils.js";

const findLocalFilesArgsSchema = z.object({
  query: z.string().min(1).max(120),
  roots: z.array(z.string().min(1).max(400)).optional(),
  max_entries: z.coerce.number().int().min(1).max(5000).optional(),
  include_dirs: z.boolean().optional().default(true)
});

export type FindLocalFilesArgs = z.infer<typeof findLocalFilesArgsSchema>;

export type FindLocalFilesResult = {
  query: string;
  rootCount: number;
  count: number;
  truncated: boolean;
  items: Array<{
    root: string;
    path: string;
    name: string;
    type: "file" | "dir";
  }>;
};

export function parseFindLocalFilesArgs(input: unknown): FindLocalFilesArgs {
  return findLocalFilesArgsSchema.parse(input ?? {});
}

function normalizeMatchText(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

async function resolveSearchRoots(args: FindLocalFilesArgs): Promise<string[]> {
  const runtime = await getGatewayRuntimeConfig();
  const policy = getLocalFilePolicy(runtime);

  if (!args.roots || args.roots.length === 0) {
    return policy.allowedRoots;
  }

  const resolved: string[] = [];
  for (const rootInput of args.roots) {
    const { absolutePath } = resolveAndAssertPath(rootInput, policy);
    let stat;
    try {
      stat = await fs.stat(absolutePath);
    } catch {
      throw new AppError("NOT_FOUND", `搜索根目录不存在: ${rootInput}`);
    }
    if (!stat.isDirectory()) {
      throw new AppError("BAD_REQUEST", `搜索根目录不是目录: ${rootInput}`);
    }
    resolved.push(absolutePath);
  }

  return resolved;
}

export async function runFindLocalFiles(args: FindLocalFilesArgs): Promise<{ text: string; data: FindLocalFilesResult }> {
  const runtime = await getGatewayRuntimeConfig();
  const policy = getLocalFilePolicy(runtime);
  const maxEntries = Math.min(args.max_entries ?? policy.maxListEntries, policy.maxListEntries);
  const searchRoots = await resolveSearchRoots(args);

  if (searchRoots.length === 0) {
    throw new AppError("MISSING_CONFIG", "LOCAL_FILE_ALLOWED_ROOTS 未配置，无法执行搜索");
  }

  const query = normalizeMatchText(args.query.trim());
  const items: FindLocalFilesResult["items"] = [];
  let truncated = false;

  for (const root of searchRoots) {
    const queue: string[] = [root];

    while (queue.length > 0) {
      const currentDir = queue.shift() as string;
      let entries;
      try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const absolute = path.join(currentDir, entry.name);
        const isDir = entry.isDirectory();
        const nameForMatch = normalizeMatchText(entry.name);
        const matched = nameForMatch.includes(query) && (args.include_dirs || !isDir);

        if (matched) {
          items.push({
            root,
            path: path.relative(root, absolute) || entry.name,
            name: entry.name,
            type: isDir ? "dir" : "file"
          });

          if (items.length >= maxEntries) {
            truncated = true;
            break;
          }
        }

        if (isDir) {
          queue.push(absolute);
        }
      }

      if (truncated) break;
    }

    if (truncated) break;
  }

  const lines = [
    `搜索关键词：${args.query}`,
    `搜索根目录：${searchRoots.length}`,
    `命中数量：${items.length}${truncated ? "（已截断）" : ""}`,
    ...items.map((item, index) => `${index + 1}. [${item.type}] ${item.path} (root: ${item.root})`)
  ];

  return {
    text: lines.join("\n"),
    data: {
      query: args.query,
      rootCount: searchRoots.length,
      count: items.length,
      truncated,
      items
    }
  };
}
