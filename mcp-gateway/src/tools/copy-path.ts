import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getGatewayRuntimeConfig } from "../config/runtime-config.js";
import { AppError } from "../errors/app-error.js";
import { getLocalFilePolicy, resolveAndAssertPath, resolveExistingPathWithFallback } from "./local-path-utils.js";

const copyPathArgsSchema = z.object({
  from: z.string().min(1).max(400),
  to: z.string().min(1).max(400),
  overwrite: z.boolean().optional().default(false)
});

export type CopyPathArgs = z.infer<typeof copyPathArgsSchema>;

export type CopyPathResult = {
  from: string;
  to: string;
  copiedType: "file" | "dir";
  overwritten: boolean;
};

export function parseCopyPathArgs(input: unknown): CopyPathArgs {
  return copyPathArgsSchema.parse(input ?? {});
}

export async function runCopyPath(args: CopyPathArgs): Promise<{ text: string; data: CopyPathResult }> {
  const runtime = await getGatewayRuntimeConfig();
  const policy = getLocalFilePolicy(runtime);

  const source = await resolveExistingPathWithFallback(args.from, policy);
  const target = resolveAndAssertPath(args.to, policy);

  const sourceStat = await fs.stat(source.absolutePath);
  const copiedType: "file" | "dir" = sourceStat.isDirectory() ? "dir" : "file";

  let targetExists = false;
  try {
    await fs.stat(target.absolutePath);
    targetExists = true;
  } catch {
    targetExists = false;
  }

  if (targetExists && !args.overwrite) {
    throw new AppError("ALREADY_EXISTS", `目标路径已存在: ${args.to}`);
  }

  const parent = path.dirname(target.absolutePath);
  await fs.mkdir(parent, { recursive: true });

  await fs.cp(source.absolutePath, target.absolutePath, {
    recursive: sourceStat.isDirectory(),
    force: args.overwrite,
    errorOnExist: !args.overwrite
  });

  return {
    text: `复制成功：${source.absolutePath} -> ${target.absolutePath}`,
    data: {
      from: source.absolutePath,
      to: target.absolutePath,
      copiedType,
      overwritten: targetExists
    }
  };
}
