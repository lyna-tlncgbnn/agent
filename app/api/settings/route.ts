import { NextResponse } from "next/server";
import { z } from "zod";
import { getMergedRuntimeConfig, writeRuntimeConfigFile } from "@/lib/runtime-config";

const settingsSchema = z.object({
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_BASE_URL: z.string().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  NOTION_API_KEY: z.string().default(""),
  NOTION_PARENT_PAGE_ID: z.string().default(""),
  LOCAL_DB_PATH: z.string().default(""),
  SEARCH_PROVIDER: z
    .enum(["auto", "duckduckgo", "bing", "serpapi_google", "serpapi_bing", "serpapi_baidu", "tavily"])
    .default("auto"),
  SEARCH_TIMEOUT_MS: z.string().default("8000"),
  SEARCH_DEFAULT_MAX_RESULTS: z.string().default("5"),
  SERPAPI_API_KEY: z.string().default(""),
  TAVILY_API_KEY: z.string().default(""),
  LOCAL_FILE_ALLOWED_ROOTS: z.string().default(""),
  LOCAL_FILE_MAX_READ_CHARS: z.string().default("12000"),
  LOCAL_FILE_MAX_LIST_ENTRIES: z.string().default("100"),
  LOCAL_FILE_MAX_PDF_PAGES: z.string().default("30")
});

export async function GET() {
  try {
    const config = await getMergedRuntimeConfig();
    return NextResponse.json({ config });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取配置失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = settingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "请求参数不合法" }, { status: 400 });
    }

    await writeRuntimeConfigFile(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存配置失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
