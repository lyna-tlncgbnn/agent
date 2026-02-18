import { z } from "zod";
import { AppError } from "../errors/app-error.js";
import { getGatewayRuntimeConfig } from "../config/runtime-config.js";

const webSearchArgsSchema = z.object({
  query: z.string().min(1).max(200),
  max_results: z.coerce.number().int().min(1).max(10).optional()
});

type SearchProvider =
  | "auto"
  | "duckduckgo"
  | "bing"
  | "serpapi_google"
  | "serpapi_bing"
  | "serpapi_baidu"
  | "tavily";

type SearchItem = {
  title: string;
  url: string;
  snippet: string;
};

type ProviderResult = {
  provider: string;
  results: SearchItem[];
};

export type WebSearchArgs = z.infer<typeof webSearchArgsSchema>;

export type WebSearchResultItem = {
  title: string;
  url: string;
  snippet: string;
};

export type WebSearchResult = {
  provider: string;
  query: string;
  results: WebSearchResultItem[];
  sources: Array<{ title: string; url: string }>;
};

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}

function toInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseDuckDuckGoHtml(html: string, limit: number): SearchItem[] {
  const items: SearchItem[] = [];
  const blockRegex = /<div class="result__body">([\s\S]*?)<\/div>\s*<\/div>/g;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = blockRegex.exec(html)) !== null && items.length < limit) {
    const block = blockMatch[1];
    const linkMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
    const url = decodeEntities(linkMatch[1]);
    const title = decodeEntities(linkMatch[2]);
    const snippet = decodeEntities(snippetMatch?.[1] ?? "");

    if (!url || !title) continue;
    items.push({ title, url, snippet });
  }

  return items;
}

function extractXmlTag(item: string, tag: string): string {
  const match = item.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeEntities(match?.[1] ?? "");
}

function parseBingRss(xml: string, limit: number): SearchItem[] {
  const items: SearchItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemRegex.exec(xml)) !== null && items.length < limit) {
    const block = itemMatch[1];
    const title = extractXmlTag(block, "title");
    const url = extractXmlTag(block, "link");
    const snippet = extractXmlTag(block, "description");
    if (!title || !url) continue;
    items.push({ title, url, snippet });
  }

  return items;
}

async function fetchTextWithTimeout(url: string, headers: Record<string, string>, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new AppError("UPSTREAM_ERROR", "联网搜索服务返回异常", { status: response.status, url });
    }

    return await response.text();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("UPSTREAM_NETWORK_ERROR", "联网搜索网络请求失败", {
      url,
      reason: error instanceof Error ? error.message : String(error)
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  provider: string
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new AppError("UPSTREAM_ERROR", `${provider} 返回异常`, {
        status: response.status,
        provider
      });
    }

    const json = (await response.json()) as Record<string, unknown>;
    return json;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("UPSTREAM_NETWORK_ERROR", `${provider} 网络请求失败`, {
      provider,
      reason: error instanceof Error ? error.message : String(error)
    });
  } finally {
    clearTimeout(timer);
  }
}

async function searchWithDuckDuckGo(query: string, limit: number, timeoutMs: number): Promise<ProviderResult> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await fetchTextWithTimeout(
    url,
    {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html"
    },
    timeoutMs
  );

  return {
    provider: "duckduckgo-html",
    results: parseDuckDuckGoHtml(html, limit)
  };
}

async function searchWithBingRss(query: string, limit: number, timeoutMs: number): Promise<ProviderResult> {
  const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`;
  const xml = await fetchTextWithTimeout(
    url,
    {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/rss+xml, application/xml, text/xml"
    },
    timeoutMs
  );

  return {
    provider: "bing-rss",
    results: parseBingRss(xml, limit)
  };
}

function parseSerpApiResults(payload: Record<string, unknown>, limit: number): SearchItem[] {
  const organic = Array.isArray(payload.organic_results) ? payload.organic_results : [];
  const items: SearchItem[] = [];

  for (const entry of organic) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title.trim() : "";
    const url = typeof record.link === "string" ? record.link.trim() : "";
    const snippet = typeof record.snippet === "string" ? record.snippet.trim() : "";
    if (!title || !url) continue;
    items.push({ title, url, snippet });
    if (items.length >= limit) break;
  }

  return items;
}

async function searchWithSerpApi(
  engine: "google" | "bing" | "baidu",
  query: string,
  limit: number,
  timeoutMs: number,
  apiKey: string
): Promise<ProviderResult> {
  if (!apiKey) {
    throw new AppError("MISSING_CONFIG", "SERPAPI_API_KEY 未配置", { provider: `serpapi_${engine}` });
  }

  const url = `https://serpapi.com/search.json?engine=${engine}&q=${encodeURIComponent(query)}&num=${limit}&api_key=${encodeURIComponent(apiKey)}`;
  const payload = await fetchJsonWithTimeout(url, { method: "GET" }, timeoutMs, `serpapi_${engine}`);

  return {
    provider: `serpapi-${engine}`,
    results: parseSerpApiResults(payload, limit)
  };
}

function parseTavilyResults(payload: Record<string, unknown>, limit: number): SearchItem[] {
  const results = Array.isArray(payload.results) ? payload.results : [];
  const items: SearchItem[] = [];

  for (const entry of results) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title.trim() : "";
    const url = typeof record.url === "string" ? record.url.trim() : "";
    const snippet = typeof record.content === "string" ? record.content.trim() : "";
    if (!title || !url) continue;
    items.push({ title, url, snippet });
    if (items.length >= limit) break;
  }

  return items;
}

async function searchWithTavily(query: string, limit: number, timeoutMs: number, apiKey: string): Promise<ProviderResult> {
  if (!apiKey) {
    throw new AppError("MISSING_CONFIG", "TAVILY_API_KEY 未配置", { provider: "tavily" });
  }

  const payload = await fetchJsonWithTimeout(
    "https://api.tavily.com/search",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: limit,
        include_answer: false
      })
    },
    timeoutMs,
    "tavily"
  );

  return {
    provider: "tavily",
    results: parseTavilyResults(payload, limit)
  };
}

function clampMaxResults(input: number, fallback: number): number {
  const value = Number.isFinite(input) ? Math.floor(input) : fallback;
  return Math.max(1, Math.min(10, value));
}

export function parseWebSearchArgs(input: unknown): WebSearchArgs {
  return webSearchArgsSchema.parse(input ?? {});
}

export async function runWebSearch(args: WebSearchArgs): Promise<{ text: string; data: WebSearchResult }> {
  const query = normalizeQuery(args.query);
  if (!query) {
    throw new AppError("BAD_REQUEST", "query 不能为空");
  }

  const runtime = await getGatewayRuntimeConfig();
  const provider = (runtime.SEARCH_PROVIDER || "auto") as SearchProvider;
  const timeoutMs = Math.max(1500, Math.min(30000, toInt(runtime.SEARCH_TIMEOUT_MS, 8000)));
  const defaultMax = clampMaxResults(toInt(runtime.SEARCH_DEFAULT_MAX_RESULTS, 5), 5);
  const maxResults = clampMaxResults(args.max_results ?? defaultMax, defaultMax);

  const providers: Array<() => Promise<ProviderResult>> =
    provider === "auto"
      ? [
          () => searchWithDuckDuckGo(query, maxResults, timeoutMs),
          () => searchWithBingRss(query, maxResults, timeoutMs),
          () => searchWithTavily(query, maxResults, timeoutMs, runtime.TAVILY_API_KEY),
          () => searchWithSerpApi("google", query, maxResults, timeoutMs, runtime.SERPAPI_API_KEY)
        ]
      : provider === "duckduckgo"
        ? [() => searchWithDuckDuckGo(query, maxResults, timeoutMs)]
        : provider === "bing"
          ? [() => searchWithBingRss(query, maxResults, timeoutMs)]
          : provider === "serpapi_google"
            ? [() => searchWithSerpApi("google", query, maxResults, timeoutMs, runtime.SERPAPI_API_KEY)]
            : provider === "serpapi_bing"
              ? [() => searchWithSerpApi("bing", query, maxResults, timeoutMs, runtime.SERPAPI_API_KEY)]
              : provider === "serpapi_baidu"
                ? [() => searchWithSerpApi("baidu", query, maxResults, timeoutMs, runtime.SERPAPI_API_KEY)]
                : [() => searchWithTavily(query, maxResults, timeoutMs, runtime.TAVILY_API_KEY)];

  const errors: string[] = [];
  for (const run of providers) {
    try {
      const result = await run();
      if (result.results.length === 0) {
        errors.push(`${result.provider}: empty results`);
        continue;
      }

      const data: WebSearchResult = {
        provider: result.provider,
        query,
        results: result.results,
        sources: result.results.map((item) => ({ title: item.title, url: item.url }))
      };

      const lines = [
        `搜索关键词：${data.query}`,
        `结果数量：${data.results.length}`,
        `搜索源：${data.provider}`,
        ...data.results.map((item, index) => `${index + 1}. ${item.title}\n${item.url}\n${item.snippet}`)
      ];

      return {
        text: lines.join("\n\n"),
        data
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new AppError("UPSTREAM_UNAVAILABLE", "联网搜索暂时不可用，请检查搜索源配置或稍后重试。", {
    query,
    provider,
    timeoutMs,
    errors
  });
}
