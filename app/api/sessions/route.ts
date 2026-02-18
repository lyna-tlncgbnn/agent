import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, listSessions } from "@/lib/chat-store";

const createSchema = z.object({
  title: z.string().trim().optional()
});

export async function GET() {
  try {
    const sessions = await listSessions();
    return NextResponse.json({ items: sessions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "读取会话失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "请求参数不合法" }, { status: 400 });
    }

    const created = await createSession(parsed.data.title || "新对话");
    return NextResponse.json({ item: created });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "创建会话失败" }, { status: 500 });
  }
}
