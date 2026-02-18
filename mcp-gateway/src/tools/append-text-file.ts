import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getGatewayRuntimeConfig } from "../config/runtime-config.js";
import { getLocalFilePolicy, resolveAndAssertPath } from "./local-path-utils.js";

const appendTextFileArgsSchema = z.object({
  path: z.string().min(1).max(400),
  content: z.string().min(1)
});

export type AppendTextFileArgs = z.infer<typeof appendTextFileArgsSchema>;

export type AppendTextFileResult = {
  path: string;
  appendedBytes: number;
};

export function parseAppendTextFileArgs(input: unknown): AppendTextFileArgs {
  return appendTextFileArgsSchema.parse(input ?? {});
}

export async function runAppendTextFile(args: AppendTextFileArgs): Promise<{ text: string; data: AppendTextFileResult }> {
  const runtime = await getGatewayRuntimeConfig();
  const policy = getLocalFilePolicy(runtime);
  const { absolutePath } = resolveAndAssertPath(args.path, policy);

  const parent = path.dirname(absolutePath);
  await fs.mkdir(parent, { recursive: true });

  await fs.appendFile(absolutePath, args.content, "utf8");
  const appendedBytes = Buffer.byteLength(args.content, "utf8");

  return {
    text: `文件追加成功：${absolutePath}`,
    data: {
      path: absolutePath,
      appendedBytes
    }
  };
}
