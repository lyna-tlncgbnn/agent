import { NextResponse } from "next/server";
import { callListNotionTargetsTool } from "@/lib/mcp-gateway-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() || undefined;

    // 主项目不再直连 Notion API，统一改为调用 Gateway MCP tool。
    const result = await callListNotionTargetsTool({ query });

    return NextResponse.json({
      defaultParent: result.defaultParent,
      items: result.items
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取 Notion 页面列表失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
