import { NextResponse } from "next/server";
import { z } from "zod";
import { callSaveChatAnswerTool } from "@/lib/mcp-gateway-client";

const saveSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  answer: z.string().min(1),
  sourceType: z.enum(["chat_answer", "bookmark_article"]).default("chat_answer"),
  parentPageId: z.string().min(1).optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = saveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "请求参数不合法" }, { status: 400 });
    }

    // Phase B: 主项目保存接口改为调用 Gateway MCP 的 save_chat_answer 工具。
    const result = await callSaveChatAnswerTool(parsed.data);

    return NextResponse.json({
      pageId: result.pageId,
      pageUrl: result.pageUrl,
      markdown: result.markdown,
      parentPageId: result.parentPageId,
      sourceType: result.sourceType
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notion 保存异常";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
