import { promises as fs } from "node:fs";
import { z } from "zod";
import { getGatewayRuntimeConfig } from "../config/runtime-config.js";
import { AppError } from "../errors/app-error.js";
import { getLocalFilePolicy, normalizeForCompare, resolveExistingPathWithFallback } from "./local-path-utils.js";

const deletePathArgsSchema = z.object({
  path: z.string().min(1).max(400),
  recursive: z.boolean().optional().default(false),
  confirm: z.string().optional().default("")
});

export type DeletePathArgs = z.infer<typeof deletePathArgsSchema>;

export type DeletePathResult = {
  path: string;
  deletedType: "file" | "dir";
};

export function parseDeletePathArgs(input: unknown): DeletePathArgs {
  return deletePathArgsSchema.parse(input ?? {});
}

export async function runDeletePath(args: DeletePathArgs): Promise<{ text: string; data: DeletePathResult }> {
  const runtime = await getGatewayRuntimeConfig();
  const policy = getLocalFilePolicy(runtime);

  if (args.confirm !== "DELETE") {
    throw new AppError("CONFIRM_REQUIRED", "删除操作需要 confirm=DELETE");
  }

  const target = await resolveExistingPathWithFallback(args.path, policy);
  const targetStat = await fs.stat(target.absolutePath);
  const deletedType: "file" | "dir" = targetStat.isDirectory() ? "dir" : "file";

  const normalizedTarget = normalizeForCompare(target.absolutePath);
  const deletingRoot = policy.allowedRoots.some((root) => normalizeForCompare(root) === normalizedTarget);
  if (deletingRoot) {
    throw new AppError("DELETE_DENIED", "不允许删除白名单根目录");
  }

  if (targetStat.isDirectory() && !args.recursive) {
    throw new AppError("BAD_REQUEST", "目录删除需要 recursive=true");
  }

  if (targetStat.isDirectory()) {
    await fs.rm(target.absolutePath, { recursive: true, force: false });
  } else {
    await fs.unlink(target.absolutePath);
  }

  return {
    text: `删除成功：${target.absolutePath}`,
    data: {
      path: target.absolutePath,
      deletedType
    }
  };
}
