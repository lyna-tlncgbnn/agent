import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getGatewayRuntimeConfig } from "../config/runtime-config.js";
import { AppError } from "../errors/app-error.js";
import { getLocalFilePolicy, resolveAndAssertPath } from "./local-path-utils.js";

const createTextFileArgsSchema = z.object({
  path: z.string().min(1).max(400),
  content: z.string().optional().default(""),
  overwrite: z.boolean().optional().default(false)
});

export type CreateTextFileArgs = z.infer<typeof createTextFileArgsSchema>;

export type CreateTextFileResult = {
  path: string;
  created: boolean;
  overwritten: boolean;
  bytes: number;
};

export function parseCreateTextFileArgs(input: unknown): CreateTextFileArgs {
  return createTextFileArgsSchema.parse(input ?? {});
}

export async function runCreateTextFile(args: CreateTextFileArgs): Promise<{ text: string; data: CreateTextFileResult }> {
  const runtime = await getGatewayRuntimeConfig();
  const policy = getLocalFilePolicy(runtime);
  const { absolutePath } = resolveAndAssertPath(args.path, policy);

  const parent = path.dirname(absolutePath);
  await fs.mkdir(parent, { recursive: true });

  const payload = args.content ?? "";
  let existed = false;

  try {
    const stat = await fs.stat(absolutePath);
    existed = stat.isFile();
    if (!stat.isFile()) {
      throw new AppError("BAD_REQUEST", `目标路径不是文件: ${args.path}`);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
  }

  if (existed && !args.overwrite) {
    throw new AppError("ALREADY_EXISTS", `文件已存在: ${args.path}`);
  }

  await fs.writeFile(absolutePath, payload, "utf8");
  const bytes = Buffer.byteLength(payload, "utf8");

  return {
    text: `${existed ? "文件已覆盖" : "文件已创建"}：${absolutePath}`,
    data: {
      path: absolutePath,
      created: !existed,
      overwritten: existed,
      bytes
    }
  };
}
