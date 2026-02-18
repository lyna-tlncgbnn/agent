import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { GatewayConfig } from "../config/gateway-config.js";
import { AppError } from "../errors/app-error.js";

type OfficialToolCallResult = {
  content: unknown;
  structuredContent?: unknown;
  isError?: boolean;
};

function buildRequestInit(config: GatewayConfig): RequestInit {
  const token = config.officialBearerToken.trim();
  if (!token) {
    throw new AppError(
      "OFFICIAL_AUTH_REQUIRED",
      "官方 MCP 透传需要 OFFICIAL_MCP_BEARER_TOKEN（或改用 custom/hybrid 模式）"
    );
  }

  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
}

export async function callOfficialTool(
  config: GatewayConfig,
  toolName: string,
  args: Record<string, unknown>
): Promise<OfficialToolCallResult> {
  const client = new Client(
    { name: "gateway-official-mcp-client", version: config.gatewayVersion },
    { capabilities: {} }
  );

  const transport = new StreamableHTTPClientTransport(new URL(config.officialMcpUrl), {
    requestInit: buildRequestInit(config)
  });

  try {
    await client.connect(transport);

    const response = await client.callTool({
      name: toolName,
      arguments: args
    });

    return {
      content: response.content,
      structuredContent: response.structuredContent,
      isError: response.isError === true
    };
  } finally {
    await client.close();
  }
}
