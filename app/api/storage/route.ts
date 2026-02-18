import { NextResponse } from "next/server";
import { getStorageStats } from "@/lib/chat-store";

export async function GET() {
  try {
    const stats = await getStorageStats();
    return NextResponse.json({ stats });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "读取存储信息失败" }, { status: 500 });
  }
}
