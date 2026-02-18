import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getGatewayRuntimeConfig } from "../config/runtime-config.js";
import { AppError } from "../errors/app-error.js";
import { getLocalFilePolicy, resolveExistingPathWithFallback, assertPathAllowed } from "./local-path-utils.js";

const renamePathArgsSchema = z.object({
  path: z.string().min(1).max(400),
  new_name: z.string().min(1).max(255)
});

export type RenamePathArgs = z.infer<typeof renamePathArgsSchema>;

export type RenamePathResult = {
  from: string;
  to: string;
  renamedType: "file" | "dir";
};

export function parseRenamePathArgs(input: unknown): RenamePathArgs {
  return renamePathArgsSchema.parse(input ?? {});
}

export async function runRenamePath(args: RenamePathArgs): Promise<{ text: string; data: RenamePathResult }> {
  const runtime = await getGatewayRuntimeConfig();
  const policy = getLocalFilePolicy(runtime);

  if (args.new_name.includes("/") || args.new_name.includes("\\")) {
    throw new AppError("BAD_REQUEST", "new_name 不能包含路径分隔符");
  }

  const source = await resolveExistingPathWithFallback(args.path, policy);
  const sourceStat = await fs.stat(source.absolutePath);
  const renamedType: "file" | "dir" = sourceStat.isDirectory() ? "dir" : "file";

  const targetPath = path.join(path.dirname(source.absolutePath), args.new_name);
  assertPathAllowed(targetPath, policy);

  try {
    await fs.stat(targetPath);
    throw new AppError("ALREADY_EXISTS", `目标路径已存在: ${targetPath}`);
  } catch (error) {
    if (error instanceof AppError) throw error;
  }

  await fs.rename(source.absolutePath, targetPath);

  return {
    text: `重命名成功：${source.absolutePath} -> ${targetPath}`,
    data: {
      from: source.absolutePath,
      to: targetPath,
      renamedType
    }
  };
}
