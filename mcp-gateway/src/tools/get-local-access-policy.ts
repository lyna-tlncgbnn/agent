import { z } from "zod";
import { getGatewayRuntimeConfig } from "../config/runtime-config.js";
import { getLocalFilePolicy } from "./local-path-utils.js";

const getLocalAccessPolicyArgsSchema = z.object({});

export type GetLocalAccessPolicyArgs = z.infer<typeof getLocalAccessPolicyArgsSchema>;

export type GetLocalAccessPolicyResult = {
  allowedRoots: string[];
  allowedRootCount: number;
  maxReadChars: number;
  maxListEntries: number;
  maxPdfPages: number;
};

export function parseGetLocalAccessPolicyArgs(input: unknown): GetLocalAccessPolicyArgs {
  return getLocalAccessPolicyArgsSchema.parse(input ?? {});
}

export async function runGetLocalAccessPolicy(): Promise<{ text: string; data: GetLocalAccessPolicyResult }> {
  const runtime = await getGatewayRuntimeConfig();
  const policy = getLocalFilePolicy(runtime);

  const lines = [
    `允许访问目录数量：${policy.allowedRoots.length}`,
    ...policy.allowedRoots.map((root, index) => `${index + 1}. ${root}`),
    `单次最大读取字符：${policy.maxReadChars}`,
    `单次最大列举条目：${policy.maxListEntries}`,
    `单次最大 PDF 页数：${policy.maxPdfPages}`
  ];

  return {
    text: lines.join("\n"),
    data: {
      allowedRoots: policy.allowedRoots,
      allowedRootCount: policy.allowedRoots.length,
      maxReadChars: policy.maxReadChars,
      maxListEntries: policy.maxListEntries,
      maxPdfPages: policy.maxPdfPages
    }
  };
}
