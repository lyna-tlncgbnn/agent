import { z } from "zod";
import type { GatewayConfig } from "../config/gateway-config.js";
import { AppError } from "../errors/app-error.js";
import { listNotionTargets } from "../notion/targets.js";
import { callOfficialTool } from "../adapters/official-notion-mcp.js";

const officialSearchSchema = z.object({
  query: z.string().min(1).max(300),
  pageSize: z.coerce.number().int().min(1).max(50).default(10)
});

export type OfficialNotionSearchArgs = z.infer<typeof officialSearchSchema>;

export function parseOfficialNotionSearchArgs(input: unknown): OfficialNotionSearchArgs {
  return officialSearchSchema.parse(input ?? {});
}

async function runCustomFallback(args: OfficialNotionSearchArgs) {
  const targets = await listNotionTargets({ query: args.query });
  return {
    text: `custom 模式返回 ${targets.items.length} 条结果`,
    data: {
      mode: "custom",
      items: targets.items,
      defaultParent: targets.defaultParent
    }
  };
}

export async function runOfficialNotionSearch(config: GatewayConfig, args: OfficialNotionSearchArgs) {
  if (config.notionRouteMode === "custom") {
    return runCustomFallback(args);
  }

  try {
    // 注意：官方工具名可能随版本变化，可通过 OFFICIAL_SEARCH_TOOL_NAME 覆盖。
    const official = await callOfficialTool(config, config.officialSearchToolName, {
      query: args.query,
      page_size: args.pageSize
    });

    if (official.isError) {
      throw new AppError("OFFICIAL_CALL_FAILED", "官方 MCP 搜索返回错误");
    }

    return {
      text: "official 模式搜索成功",
      data: {
        mode: "official",
        content: official.content,
        structuredContent: official.structuredContent
      }
    };
  } catch (error) {
    if (config.notionRouteMode === "official") {
      if (error instanceof AppError) throw error;
      throw new AppError("OFFICIAL_CALL_FAILED", error instanceof Error ? error.message : "官方 MCP 搜索失败");
    }

    // hybrid: 官方失败时自动降级到自定义搜索。
    return runCustomFallback(args);
  }
}
