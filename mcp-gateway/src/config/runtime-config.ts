import { promises as fs } from "node:fs";
import path from "node:path";

export type RuntimeConfig = {
  NOTION_API_KEY: string;
  NOTION_PARENT_PAGE_ID: string;
  SEARCH_PROVIDER: string;
  SEARCH_TIMEOUT_MS: string;
  SEARCH_DEFAULT_MAX_RESULTS: string;
  SERPAPI_API_KEY: string;
  TAVILY_API_KEY: string;
  LOCAL_FILE_ALLOWED_ROOTS: string;
  LOCAL_FILE_MAX_READ_CHARS: string;
  LOCAL_FILE_MAX_LIST_ENTRIES: string;
  LOCAL_FILE_MAX_PDF_PAGES: string;
};

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function readJsonIfExists(filePath: string): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // 文件不存在或格式异常时直接回退默认值
  }
  return {};
}

async function readRuntimeConfigFile(): Promise<Record<string, unknown>> {
  // 兼容两种启动目录：
  // 1) cwd=项目根目录（推荐）
  // 2) cwd=mcp-gateway 子目录
  const candidates = [
    path.join(process.cwd(), ".runtime-config.json"),
    path.join(process.cwd(), "..", ".runtime-config.json")
  ];

  for (const filePath of candidates) {
    const content = await readJsonIfExists(filePath);
    if (Object.keys(content).length > 0) {
      return content;
    }
  }

  return {};
}

export async function getGatewayRuntimeConfig(): Promise<RuntimeConfig> {
  const fileConfig = await readRuntimeConfigFile();

  return {
    NOTION_API_KEY: toText(fileConfig.NOTION_API_KEY) || toText(process.env.NOTION_API_KEY),
    NOTION_PARENT_PAGE_ID: toText(fileConfig.NOTION_PARENT_PAGE_ID) || toText(process.env.NOTION_PARENT_PAGE_ID),
    SEARCH_PROVIDER: toText(fileConfig.SEARCH_PROVIDER) || toText(process.env.SEARCH_PROVIDER) || "auto",
    SEARCH_TIMEOUT_MS: toText(fileConfig.SEARCH_TIMEOUT_MS) || toText(process.env.SEARCH_TIMEOUT_MS) || "8000",
    SEARCH_DEFAULT_MAX_RESULTS:
      toText(fileConfig.SEARCH_DEFAULT_MAX_RESULTS) || toText(process.env.SEARCH_DEFAULT_MAX_RESULTS) || "5",
    SERPAPI_API_KEY: toText(fileConfig.SERPAPI_API_KEY) || toText(process.env.SERPAPI_API_KEY),
    TAVILY_API_KEY: toText(fileConfig.TAVILY_API_KEY) || toText(process.env.TAVILY_API_KEY),
    LOCAL_FILE_ALLOWED_ROOTS:
      toText(fileConfig.LOCAL_FILE_ALLOWED_ROOTS) || toText(process.env.LOCAL_FILE_ALLOWED_ROOTS),
    LOCAL_FILE_MAX_READ_CHARS:
      toText(fileConfig.LOCAL_FILE_MAX_READ_CHARS) || toText(process.env.LOCAL_FILE_MAX_READ_CHARS) || "12000",
    LOCAL_FILE_MAX_LIST_ENTRIES:
      toText(fileConfig.LOCAL_FILE_MAX_LIST_ENTRIES) || toText(process.env.LOCAL_FILE_MAX_LIST_ENTRIES) || "100",
    LOCAL_FILE_MAX_PDF_PAGES:
      toText(fileConfig.LOCAL_FILE_MAX_PDF_PAGES) || toText(process.env.LOCAL_FILE_MAX_PDF_PAGES) || "30"
  };
}

export async function getRequiredGatewayRuntimeValue(key: keyof RuntimeConfig): Promise<string> {
  const config = await getGatewayRuntimeConfig();
  const value = config[key];

  if (!value) {
    throw new Error(`缺少配置: ${key}`);
  }

  return value;
}
