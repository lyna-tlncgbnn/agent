import { promises as fs } from "node:fs";
import path from "node:path";

export type RuntimeConfig = {
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL: string;
  OPENAI_MODEL: string;
  NOTION_API_KEY: string;
  NOTION_PARENT_PAGE_ID: string;
  LOCAL_DB_PATH: string;
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

const configPath = path.join(process.cwd(), ".runtime-config.json");

function resolveDefaultDbPath(): string {
  return path.join(process.cwd(), "data", "assistant.db");
}

const defaultConfig: RuntimeConfig = {
  OPENAI_API_KEY: "",
  OPENAI_BASE_URL: "",
  OPENAI_MODEL: "",
  NOTION_API_KEY: "",
  NOTION_PARENT_PAGE_ID: "",
  LOCAL_DB_PATH: resolveDefaultDbPath(),
  SEARCH_PROVIDER: "auto",
  SEARCH_TIMEOUT_MS: "8000",
  SEARCH_DEFAULT_MAX_RESULTS: "5",
  SERPAPI_API_KEY: "",
  TAVILY_API_KEY: "",
  LOCAL_FILE_ALLOWED_ROOTS: "",
  LOCAL_FILE_MAX_READ_CHARS: "12000",
  LOCAL_FILE_MAX_LIST_ENTRIES: "100",
  LOCAL_FILE_MAX_PDF_PAGES: "30"
};

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function readRuntimeConfigFile(): Promise<Partial<RuntimeConfig>> {
  try {
    const content = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(content) as Record<string, unknown>;

    return {
      OPENAI_API_KEY: toStringValue(parsed.OPENAI_API_KEY),
      OPENAI_BASE_URL: toStringValue(parsed.OPENAI_BASE_URL),
      OPENAI_MODEL: toStringValue(parsed.OPENAI_MODEL),
      NOTION_API_KEY: toStringValue(parsed.NOTION_API_KEY),
      NOTION_PARENT_PAGE_ID: toStringValue(parsed.NOTION_PARENT_PAGE_ID),
      LOCAL_DB_PATH: toStringValue(parsed.LOCAL_DB_PATH),
      SEARCH_PROVIDER: toStringValue(parsed.SEARCH_PROVIDER),
      SEARCH_TIMEOUT_MS: toStringValue(parsed.SEARCH_TIMEOUT_MS),
      SEARCH_DEFAULT_MAX_RESULTS: toStringValue(parsed.SEARCH_DEFAULT_MAX_RESULTS),
      SERPAPI_API_KEY: toStringValue(parsed.SERPAPI_API_KEY),
      TAVILY_API_KEY: toStringValue(parsed.TAVILY_API_KEY),
      LOCAL_FILE_ALLOWED_ROOTS: toStringValue(parsed.LOCAL_FILE_ALLOWED_ROOTS),
      LOCAL_FILE_MAX_READ_CHARS: toStringValue(parsed.LOCAL_FILE_MAX_READ_CHARS),
      LOCAL_FILE_MAX_LIST_ENTRIES: toStringValue(parsed.LOCAL_FILE_MAX_LIST_ENTRIES),
      LOCAL_FILE_MAX_PDF_PAGES: toStringValue(parsed.LOCAL_FILE_MAX_PDF_PAGES)
    };
  } catch {
    return {};
  }
}

export async function writeRuntimeConfigFile(input: RuntimeConfig): Promise<void> {
  const normalized: RuntimeConfig = {
    OPENAI_API_KEY: input.OPENAI_API_KEY.trim(),
    OPENAI_BASE_URL: input.OPENAI_BASE_URL.trim(),
    OPENAI_MODEL: input.OPENAI_MODEL.trim(),
    NOTION_API_KEY: input.NOTION_API_KEY.trim(),
    NOTION_PARENT_PAGE_ID: input.NOTION_PARENT_PAGE_ID.trim(),
    LOCAL_DB_PATH: input.LOCAL_DB_PATH.trim(),
    SEARCH_PROVIDER: input.SEARCH_PROVIDER.trim(),
    SEARCH_TIMEOUT_MS: input.SEARCH_TIMEOUT_MS.trim(),
    SEARCH_DEFAULT_MAX_RESULTS: input.SEARCH_DEFAULT_MAX_RESULTS.trim(),
    SERPAPI_API_KEY: input.SERPAPI_API_KEY.trim(),
    TAVILY_API_KEY: input.TAVILY_API_KEY.trim(),
    LOCAL_FILE_ALLOWED_ROOTS: input.LOCAL_FILE_ALLOWED_ROOTS.trim(),
    LOCAL_FILE_MAX_READ_CHARS: input.LOCAL_FILE_MAX_READ_CHARS.trim(),
    LOCAL_FILE_MAX_LIST_ENTRIES: input.LOCAL_FILE_MAX_LIST_ENTRIES.trim(),
    LOCAL_FILE_MAX_PDF_PAGES: input.LOCAL_FILE_MAX_PDF_PAGES.trim()
  };

  await fs.writeFile(configPath, JSON.stringify(normalized, null, 2), "utf8");
}

export async function getMergedRuntimeConfig(): Promise<RuntimeConfig> {
  const fileConfig = await readRuntimeConfigFile();

  return {
    OPENAI_API_KEY: fileConfig.OPENAI_API_KEY || process.env.OPENAI_API_KEY || defaultConfig.OPENAI_API_KEY,
    OPENAI_BASE_URL: fileConfig.OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || defaultConfig.OPENAI_BASE_URL,
    OPENAI_MODEL: fileConfig.OPENAI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
    NOTION_API_KEY: fileConfig.NOTION_API_KEY || process.env.NOTION_API_KEY || defaultConfig.NOTION_API_KEY,
    NOTION_PARENT_PAGE_ID:
      fileConfig.NOTION_PARENT_PAGE_ID || process.env.NOTION_PARENT_PAGE_ID || defaultConfig.NOTION_PARENT_PAGE_ID,
    LOCAL_DB_PATH: fileConfig.LOCAL_DB_PATH || process.env.LOCAL_DB_PATH || defaultConfig.LOCAL_DB_PATH,
    SEARCH_PROVIDER: fileConfig.SEARCH_PROVIDER || process.env.SEARCH_PROVIDER || defaultConfig.SEARCH_PROVIDER,
    SEARCH_TIMEOUT_MS: fileConfig.SEARCH_TIMEOUT_MS || process.env.SEARCH_TIMEOUT_MS || defaultConfig.SEARCH_TIMEOUT_MS,
    SEARCH_DEFAULT_MAX_RESULTS:
      fileConfig.SEARCH_DEFAULT_MAX_RESULTS ||
      process.env.SEARCH_DEFAULT_MAX_RESULTS ||
      defaultConfig.SEARCH_DEFAULT_MAX_RESULTS,
    SERPAPI_API_KEY: fileConfig.SERPAPI_API_KEY || process.env.SERPAPI_API_KEY || defaultConfig.SERPAPI_API_KEY,
    TAVILY_API_KEY: fileConfig.TAVILY_API_KEY || process.env.TAVILY_API_KEY || defaultConfig.TAVILY_API_KEY,
    LOCAL_FILE_ALLOWED_ROOTS:
      fileConfig.LOCAL_FILE_ALLOWED_ROOTS ||
      process.env.LOCAL_FILE_ALLOWED_ROOTS ||
      defaultConfig.LOCAL_FILE_ALLOWED_ROOTS,
    LOCAL_FILE_MAX_READ_CHARS:
      fileConfig.LOCAL_FILE_MAX_READ_CHARS ||
      process.env.LOCAL_FILE_MAX_READ_CHARS ||
      defaultConfig.LOCAL_FILE_MAX_READ_CHARS,
    LOCAL_FILE_MAX_LIST_ENTRIES:
      fileConfig.LOCAL_FILE_MAX_LIST_ENTRIES ||
      process.env.LOCAL_FILE_MAX_LIST_ENTRIES ||
      defaultConfig.LOCAL_FILE_MAX_LIST_ENTRIES,
    LOCAL_FILE_MAX_PDF_PAGES:
      fileConfig.LOCAL_FILE_MAX_PDF_PAGES ||
      process.env.LOCAL_FILE_MAX_PDF_PAGES ||
      defaultConfig.LOCAL_FILE_MAX_PDF_PAGES
  };
}

export async function getRequiredRuntimeValue(key: keyof RuntimeConfig): Promise<string> {
  const config = await getMergedRuntimeConfig();
  const value = config[key];

  if (!value || value.trim().length === 0) {
    throw new Error(`缺少配置: ${key}`);
  }

  return value;
}
