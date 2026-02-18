import { NextResponse } from "next/server";
import { z } from "zod";
import { appendMessage, getSessionMessages } from "@/lib/chat-store";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1)
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const messages = await getSessionMessages(id);
    return NextResponse.json({ items: messages });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "读取消息失败" }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = messageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "请求参数不合法" }, { status: 400 });
    }

    const created = await appendMessage(id, parsed.data.role, parsed.data.content);
    return NextResponse.json({ item: created });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "保存消息失败" }, { status: 500 });
  }
}
