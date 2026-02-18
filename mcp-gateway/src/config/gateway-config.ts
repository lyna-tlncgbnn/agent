import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

const configSchema = z.object({
  gatewayName: z.string().default("notion-gateway-mcp"),
  gatewayVersion: z.string().default("0.1.0"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  healthPort: z.coerce.number().int().min(0).default(8788),
  notionRouteMode: z.enum(["custom", "official", "hybrid"]).default("hybrid"),
  officialMcpUrl: z.string().url().default("https://mcp.notion.com/mcp"),
  officialBearerToken: z.string().default(""),
  officialSearchToolName: z.string().default("notion-search")
});

export type GatewayConfig = z.infer<typeof configSchema>;

async function readConfigFile(): Promise<Record<string, unknown>> {
  const configPath = path.join(process.cwd(), ".gateway-config.json");
  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Use env/defaults.
  }
  return {};
}

export async function loadGatewayConfig(): Promise<GatewayConfig> {
  const fileConfig = await readConfigFile();
  return configSchema.parse({
    gatewayName: process.env.GATEWAY_NAME ?? fileConfig.gatewayName,
    gatewayVersion: process.env.GATEWAY_VERSION ?? fileConfig.gatewayVersion,
    logLevel: process.env.GATEWAY_LOG_LEVEL ?? fileConfig.logLevel,
    healthPort: process.env.GATEWAY_HEALTH_PORT ?? fileConfig.healthPort,
    notionRouteMode: process.env.NOTION_ROUTE_MODE ?? fileConfig.notionRouteMode,
    officialMcpUrl: process.env.OFFICIAL_MCP_URL ?? fileConfig.officialMcpUrl,
    officialBearerToken: process.env.OFFICIAL_MCP_BEARER_TOKEN ?? fileConfig.officialBearerToken,
    officialSearchToolName: process.env.OFFICIAL_SEARCH_TOOL_NAME ?? fileConfig.officialSearchToolName
  });
}
