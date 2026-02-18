import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteSession, renameSession } from "@/lib/chat-store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const renameSchema = z.object({
  title: z.string().trim().min(1)
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = renameSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "请求参数不合法" }, { status: 400 });
    }

    await renameSession(id, parsed.data.title);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "重命名会话失败" }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteSession(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "删除会话失败" }, { status: 500 });
  }
}
