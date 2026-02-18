import { promises as fs } from "node:fs";
import path from "node:path";
import type { RuntimeConfig } from "../config/runtime-config.js";
import { AppError } from "../errors/app-error.js";

export type LocalFilePolicy = {
  allowedRoots: string[];
  maxReadChars: number;
  maxListEntries: number;
  maxPdfPages: number;
};

function toPositiveInt(raw: string, fallback: number, min: number, max: number): number {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

export function normalizeForCompare(input: string): string {
  let normalized = path.resolve(input);

  if (process.platform === "win32") {
    normalized = normalized.replace(/\//g, "\\").toLowerCase();
  }

  return normalized.endsWith(path.sep) ? normalized.slice(0, -1) : normalized;
}

export function parseAllowedRoots(raw: string): string[] {
  return raw
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => path.resolve(item));
}

export function getLocalFilePolicy(config: RuntimeConfig): LocalFilePolicy {
  return {
    allowedRoots: parseAllowedRoots(config.LOCAL_FILE_ALLOWED_ROOTS),
    maxReadChars: toPositiveInt(config.LOCAL_FILE_MAX_READ_CHARS, 12000, 500, 200000),
    maxListEntries: toPositiveInt(config.LOCAL_FILE_MAX_LIST_ENTRIES, 100, 1, 5000),
    maxPdfPages: toPositiveInt(config.LOCAL_FILE_MAX_PDF_PAGES, 30, 1, 300)
  };
}

export function resolveInputPath(inputPath: string, policy: LocalFilePolicy): string {
  const raw = inputPath.trim();
  if (!raw) {
    throw new AppError("BAD_REQUEST", "path 不能为空");
  }

  if (path.isAbsolute(raw)) {
    return path.resolve(raw);
  }

  if (policy.allowedRoots.length === 0) {
    throw new AppError("MISSING_CONFIG", "LOCAL_FILE_ALLOWED_ROOTS 未配置，无法解析相对路径");
  }

  return path.resolve(policy.allowedRoots[0], raw);
}

export function assertPathAllowed(absolutePath: string, policy: LocalFilePolicy): { absolutePath: string; allowedRoot: string } {
  if (policy.allowedRoots.length === 0) {
    throw new AppError("MISSING_CONFIG", "LOCAL_FILE_ALLOWED_ROOTS 未配置，已拒绝本地文件访问");
  }

  const target = normalizeForCompare(absolutePath);

  for (const root of policy.allowedRoots) {
    const normalizedRoot = normalizeForCompare(root);
    if (target === normalizedRoot || target.startsWith(`${normalizedRoot}${path.sep}`)) {
      return { absolutePath: path.resolve(absolutePath), allowedRoot: root };
    }
  }

  throw new AppError("PATH_NOT_ALLOWED", `路径不在允许范围内: ${absolutePath}`, {
    allowedRoots: policy.allowedRoots
  });
}

export function resolveAndAssertPath(inputPath: string, policy: LocalFilePolicy): { absolutePath: string; allowedRoot: string } {
  const absolutePath = resolveInputPath(inputPath, policy);
  return assertPathAllowed(absolutePath, policy);
}

export async function resolveExistingPathWithFallback(
  inputPath: string,
  policy: LocalFilePolicy
): Promise<{ absolutePath: string; allowedRoot: string }> {
  const raw = inputPath.trim();
  if (!raw) {
    throw new AppError("BAD_REQUEST", "path 不能为空");
  }

  if (path.isAbsolute(raw)) {
    const resolved = resolveAndAssertPath(raw, policy);
    try {
      await fs.stat(resolved.absolutePath);
      return resolved;
    } catch {
      throw new AppError("NOT_FOUND", `路径不存在: ${inputPath}`);
    }
  }

  if (policy.allowedRoots.length === 0) {
    throw new AppError("MISSING_CONFIG", "LOCAL_FILE_ALLOWED_ROOTS 未配置，无法解析相对路径");
  }

  for (const root of policy.allowedRoots) {
    const candidate = path.resolve(root, raw);
    try {
      await fs.stat(candidate);
      return {
        absolutePath: candidate,
        allowedRoot: root
      };
    } catch {
      // ignore and continue to next root
    }
  }

  throw new AppError("NOT_FOUND", `在允许访问的路径中未找到: ${inputPath}`, {
    allowedRoots: policy.allowedRoots
  });
}
