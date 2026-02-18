import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getGatewayRuntimeConfig } from "../config/runtime-config.js";
import { AppError } from "../errors/app-error.js";
import { getLocalFilePolicy, resolveAndAssertPath } from "./local-path-utils.js";

const writeTextFileArgsSchema = z.object({
  path: z.string().min(1).max(400),
  content: z.string(),
  overwrite: z.boolean().optional().default(true)
});

export type WriteTextFileArgs = z.infer<typeof writeTextFileArgsSchema>;

export type WriteTextFileResult = {
  path: string;
  overwritten: boolean;
  bytes: number;
};

export function parseWriteTextFileArgs(input: unknown): WriteTextFileArgs {
  return writeTextFileArgsSchema.parse(input ?? {});
}

export async function runWriteTextFile(args: WriteTextFileArgs): Promise<{ text: string; data: WriteTextFileResult }> {
  const runtime = await getGatewayRuntimeConfig();
  const policy = getLocalFilePolicy(runtime);
  const { absolutePath } = resolveAndAssertPath(args.path, policy);

  const parent = path.dirname(absolutePath);
  await fs.mkdir(parent, { recursive: true });

  let existed = false;
  try {
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) {
      throw new AppError("BAD_REQUEST", `目标路径不是文件: ${args.path}`);
    }
    existed = true;
  } catch (error) {
    if (error instanceof AppError) throw error;
  }

  if (existed && !args.overwrite) {
    throw new AppError("ALREADY_EXISTS", `文件已存在: ${args.path}`);
  }

  await fs.writeFile(absolutePath, args.content, "utf8");
  const bytes = Buffer.byteLength(args.content, "utf8");

  return {
    text: `文件写入成功：${absolutePath}`,
    data: {
      path: absolutePath,
      overwritten: existed,
      bytes
    }
  };
}
