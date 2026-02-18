import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getGatewayRuntimeConfig } from "../config/runtime-config.js";
import { AppError } from "../errors/app-error.js";
import { getLocalFilePolicy, resolveAndAssertPath, resolveExistingPathWithFallback } from "./local-path-utils.js";

const movePathArgsSchema = z.object({
  from: z.string().min(1).max(400),
  to: z.string().min(1).max(400),
  overwrite: z.boolean().optional().default(false)
});

export type MovePathArgs = z.infer<typeof movePathArgsSchema>;

export type MovePathResult = {
  from: string;
  to: string;
  movedType: "file" | "dir";
  overwritten: boolean;
};

export function parseMovePathArgs(input: unknown): MovePathArgs {
  return movePathArgsSchema.parse(input ?? {});
}

export async function runMovePath(args: MovePathArgs): Promise<{ text: string; data: MovePathResult }> {
  const runtime = await getGatewayRuntimeConfig();
  const policy = getLocalFilePolicy(runtime);

  const source = await resolveExistingPathWithFallback(args.from, policy);
  const target = resolveAndAssertPath(args.to, policy);

  const sourceStat = await fs.stat(source.absolutePath);
  const movedType: "file" | "dir" = sourceStat.isDirectory() ? "dir" : "file";

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

  if (targetExists && args.overwrite) {
    await fs.rm(target.absolutePath, { recursive: true, force: true });
  }

  try {
    await fs.rename(source.absolutePath, target.absolutePath);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code !== "EXDEV") {
      throw error;
    }

    await fs.cp(source.absolutePath, target.absolutePath, {
      recursive: sourceStat.isDirectory(),
      force: true
    });
    await fs.rm(source.absolutePath, { recursive: sourceStat.isDirectory(), force: true });
  }

  return {
    text: `移动成功：${source.absolutePath} -> ${target.absolutePath}`,
    data: {
      from: source.absolutePath,
      to: target.absolutePath,
      movedType,
      overwritten: targetExists
    }
  };
}
