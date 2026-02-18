import { NextResponse } from "next/server";
import { clearAllSessions } from "@/lib/chat-store";

export async function POST() {
  try {
    await clearAllSessions();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "清空数据失败" }, { status: 500 });
  }
}
