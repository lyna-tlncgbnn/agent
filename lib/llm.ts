import { AIMessage, HumanMessage, SystemMessage, type BaseMessageLike } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import {
  callAppendTextFileTool,
  callCopyPathTool,
  callCreateTextFileTool,
  callDeletePathTool,
  callExtractPdfTextTool,
  callFindLocalFilesTool,
  callGetLocalAccessPolicyTool,
  callGetWeatherTool,
  callListLocalFilesTool,
  callMovePathTool,
  callReadOfficeFileTool,
  callReadTextFileTool,
  callRenamePathTool,
  callWriteTextFileTool,
  callWebSearchTool
} from "@/lib/mcp-gateway-client";
import { getRequiredRuntimeValue, getMergedRuntimeConfig } from "@/lib/runtime-config";

type InputMessage = {
  role: "user" | "assistant";
  content: string;
};

type AgentToolName =
  | "get_weather"
  | "web_search"
  | "list_local_files"
  | "read_text_file"
  | "extract_pdf_text"
  | "get_local_access_policy"
  | "read_office_file"
  | "create_text_file"
  | "write_text_file"
  | "append_text_file"
  | "copy_path"
  | "move_path"
  | "rename_path"
  | "delete_path"
  | "find_local_files";

type AgentAction =
  | {
      type: "final";
      answer: string;
    }
  | {
      type: "tool_call";
      toolName: AgentToolName;
      arguments: Record<string, unknown>;
      rationale?: string;
    };

type ToolCallResult = {
  toolName: AgentToolName;
  text: string;
  sources?: Array<{ title: string; url: string }>;
  provider?: string;
};

export type AgentToolProgressEvent =
  | {
      type: "tool_start";
      step: number;
      toolName: AgentToolName;
      args: Record<string, unknown>;
    }
  | {
      type: "tool_result";
      step: number;
      toolName: AgentToolName;
      ok: boolean;
      durationMs: number;
      summary: string;
    };

const MAX_TOOL_STEPS = 3;

function getTextFromContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "object" && item !== null && "text" in item) {
          const text = (item as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("\n");
  }

  return "";
}

function toLangChainMessages(messages: InputMessage[]): BaseMessageLike[] {
  return messages.map((message) =>
    message.role === "user" ? new HumanMessage(message.content) : new AIMessage(message.content)
  );
}

function inferForecastDays(text: string): number {
  if (/(后天|day after tomorrow)/i.test(text)) return 3;
  if (/(明天|tomorrow)/i.test(text)) return 2;
  return 1;
}

function formatWeatherAnswer(data: Awaited<ReturnType<typeof callGetWeatherTool>>): string {
  const lines = [
    `实时天气：${data.location}`,
    `天气：${data.current.weatherText}`,
    `温度：${data.current.temperatureC ?? "未知"}°C，体感：${data.current.apparentTemperatureC ?? "未知"}°C`,
    `湿度：${data.current.humidity ?? "未知"}%，降水：${data.current.precipitationMm ?? "未知"} mm`,
    `风速：${data.current.windSpeedKmh ?? "未知"} km/h`,
    `更新时间：${data.current.time}（${data.timezone}）`,
    `数据来源：${data.provider}`
  ];
  return lines.join("\n");
}

function formatWebSearchToolResult(data: Awaited<ReturnType<typeof callWebSearchTool>>): ToolCallResult {
  const lines: string[] = [
    `联网搜索关键词：${data.query}`,
    `结果数：${data.results.length}（来源：${data.provider}）`,
    ""
  ];

  data.results.slice(0, 5).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.title}`);
    if (item.snippet) {
      lines.push(`   ${item.snippet}`);
    }
    lines.push(`   ${item.url}`);
  });

  return {
    toolName: "web_search",
    text: lines.join("\n"),
    sources: data.sources,
    provider: data.provider
  };
}

function stripMarkdownCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;

  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() || trimmed;
}

function tryParseAgentAction(raw: string): AgentAction | null {
  const cleaned = stripMarkdownCodeFence(raw);

  try {
    const parsed = JSON.parse(cleaned) as Partial<AgentAction>;

    if (parsed.type === "final" && typeof parsed.answer === "string" && parsed.answer.trim()) {
      return {
        type: "final",
        answer: parsed.answer.trim()
      };
    }

    if (
      parsed.type === "tool_call" &&
      (
        parsed.toolName === "get_weather" ||
        parsed.toolName === "web_search" ||
        parsed.toolName === "list_local_files" ||
        parsed.toolName === "read_text_file" ||
        parsed.toolName === "extract_pdf_text" ||
        parsed.toolName === "get_local_access_policy" ||
        parsed.toolName === "read_office_file" ||
        parsed.toolName === "create_text_file" ||
        parsed.toolName === "write_text_file" ||
        parsed.toolName === "append_text_file" ||
        parsed.toolName === "copy_path" ||
        parsed.toolName === "move_path" ||
        parsed.toolName === "rename_path" ||
        parsed.toolName === "delete_path" ||
        parsed.toolName === "find_local_files"
      ) &&
      parsed.arguments &&
      typeof parsed.arguments === "object"
    ) {
      return {
        type: "tool_call",
        toolName: parsed.toolName,
        arguments: parsed.arguments as Record<string, unknown>,
        rationale: typeof parsed.rationale === "string" ? parsed.rationale : undefined
      };
    }
  } catch {
    return null;
  }

  return null;
}

function getAgentSystemPrompt(now: Date): string {
  const today = now.toISOString().slice(0, 10);

  return [
    "你是一个具备工具调用能力的中文助手。",
    `今天日期（UTC）是：${today}。`,
    "你必须根据用户问题决定是否调用工具，不要靠固定关键词硬编码。",
    "可用工具如下：",
    "1) get_weather",
    "   - 用途：查询城市/地区天气",
    "   - 参数：{ query: string, days?: number(1-3) }",
    "2) web_search",
    "   - 用途：联网搜索最新信息、新闻、价格、公告、事件",
    "   - 参数：{ query: string, max_results?: number(1-10) }",
    "3) list_local_files",
    "   - 用途：列出本地目录的文件和子目录（受白名单限制）",
    "   - 参数：{ path: string, recursive?: boolean, max_entries?: number }",
    "4) read_text_file",
    "   - 用途：读取本地文本文件内容（txt/md/json/csv/code 等）",
    "   - 参数：{ path: string, max_chars?: number }",
    "5) extract_pdf_text",
    "   - 用途：提取本地 PDF 文本（扫描版可能失败）",
    "   - 参数：{ path: string, max_pages?: number }",
    "6) read_office_file",
    "   - 用途：读取本地 Office 文档（docx/xlsx/pptx）文本",
    "   - 参数：{ path: string, max_chars?: number }",
    "7) get_local_access_policy",
    "   - 用途：读取当前可访问的本地白名单目录与读取限制",
    "   - 参数：{}",
    "8) create_text_file",
    "   - 用途：创建文本文件",
    "   - 参数：{ path: string, content?: string, overwrite?: boolean }",
    "9) write_text_file",
    "   - 用途：写入文本文件",
    "   - 参数：{ path: string, content: string, overwrite?: boolean }",
    "10) append_text_file",
    "   - 用途：向文本文件追加内容",
    "   - 参数：{ path: string, content: string }",
    "11) copy_path",
    "   - 用途：复制文件或目录",
    "   - 参数：{ from: string, to: string, overwrite?: boolean }",
    "12) move_path",
    "   - 用途：移动文件或目录",
    "   - 参数：{ from: string, to: string, overwrite?: boolean }",
    "13) rename_path",
    "   - 用途：重命名文件或目录",
    "   - 参数：{ path: string, new_name: string }",
    "14) delete_path",
    "   - 用途：删除文件或目录（危险操作）",
    "   - 参数：{ path: string, recursive?: boolean, confirm: \"DELETE\" }",
    "15) find_local_files",
    "   - 用途：在白名单目录中按名称搜索文件/目录",
    "   - 参数：{ query: string, roots?: string[], max_entries?: number, include_dirs?: boolean }",
    "决策规则：",
    "- 若问题需要实时/最新/外部事实，优先调用工具。",
    "- 若用户让你查看本地文件或论文，优先调用本地文件工具。",
    "- 若用户提到 word/excel/ppt/docx/xlsx/pptx，优先调用 read_office_file。",
    "- 若用户询问“可访问路径/白名单目录/本地权限设置”，优先调用 get_local_access_policy。",
    "- 若用户只知道文件名、不知道在哪个目录，优先调用 find_local_files。",
    "- 删除/覆盖类操作要谨慎，只有用户明确要求时才调用。",
    "- 若不需要外部信息，直接给最终回答。",
    "- 允许多步调用，但总步数受限。",
    "输出必须是 JSON，且只能是以下两种之一：",
    '{"type":"tool_call","toolName":"get_weather|web_search|list_local_files|read_text_file|extract_pdf_text|read_office_file|get_local_access_policy|create_text_file|write_text_file|append_text_file|copy_path|move_path|rename_path|delete_path|find_local_files","arguments":{...},"rationale":"可选"}',
    '{"type":"final","answer":"给用户的最终回答"}',
    "禁止输出除 JSON 之外的任何内容。"
  ].join("\n");
}

function appendSourcesIfNeeded(
  answer: string,
  sources: Array<{ title: string; url: string }>,
  searchProviders: string[]
): string {
  const uniqueProviders = Array.from(new Set(searchProviders.filter((item) => item.trim().length > 0)));
  const providerLine = uniqueProviders.length > 0 ? `搜索源：${uniqueProviders.join(", ")}` : "";

  const unique = new Map<string, { title: string; url: string }>();
  sources.forEach((item) => {
    if (!item.url) return;
    if (!unique.has(item.url)) {
      unique.set(item.url, item);
    }
  });

  if (unique.size === 0) {
    return providerLine ? `${answer}\n\n${providerLine}` : answer;
  }

  const sourceLines = Array.from(unique.values())
    .slice(0, 8)
    .map((item, index) => `${index + 1}. ${item.title} - ${item.url}`)
    .join("\n");

  return `${answer}\n\n${providerLine ? `${providerLine}\n\n` : ""}参考来源：\n${sourceLines}`;
}

function* streamTextByChunks(text: string, chunkSize = 48): Generator<string> {
  for (let index = 0; index < text.length; index += chunkSize) {
    yield text.slice(index, index + chunkSize);
  }
}

async function createModel() {
  const [apiKey, runtimeConfig] = await Promise.all([
    getRequiredRuntimeValue("OPENAI_API_KEY"),
    getMergedRuntimeConfig()
  ]);

  return new ChatOpenAI({
    apiKey,
    model: runtimeConfig.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    configuration: runtimeConfig.OPENAI_BASE_URL
      ? { baseURL: runtimeConfig.OPENAI_BASE_URL }
      : undefined
  });
}

async function runToolCall(action: Extract<AgentAction, { type: "tool_call" }>, latestUserText: string): Promise<ToolCallResult> {
  if (action.toolName === "get_weather") {
    const rawQuery = action.arguments.query;
    const rawDays = action.arguments.days;

    const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
    if (!query) {
      throw new Error("get_weather 参数缺少 query");
    }

    const days =
      typeof rawDays === "number" && Number.isFinite(rawDays)
        ? Math.max(1, Math.min(3, Math.floor(rawDays)))
        : inferForecastDays(latestUserText);

    const weather = await callGetWeatherTool({ query, days });
    return {
      toolName: "get_weather",
      text: formatWeatherAnswer(weather)
    };
  }

  if (action.toolName === "web_search") {
    const rawQuery = action.arguments.query;
    const rawMax = action.arguments.max_results;

    const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
    if (!query) {
      throw new Error("web_search 参数缺少 query");
    }

    const maxResults =
      typeof rawMax === "number" && Number.isFinite(rawMax)
        ? Math.max(1, Math.min(10, Math.floor(rawMax)))
        : 5;

    const result = await callWebSearchTool({ query, max_results: maxResults });
    return formatWebSearchToolResult(result);
  }

  if (action.toolName === "list_local_files") {
    const rawPath = action.arguments.path;
    const rawRecursive = action.arguments.recursive;
    const rawMax = action.arguments.max_entries;

    const listPath = typeof rawPath === "string" ? rawPath.trim() : "";
    if (!listPath) {
      throw new Error("list_local_files 参数缺少 path");
    }

    const listResult = await callListLocalFilesTool({
      path: listPath,
      recursive: typeof rawRecursive === "boolean" ? rawRecursive : false,
      max_entries: typeof rawMax === "number" && Number.isFinite(rawMax) ? rawMax : undefined
    });

    return {
      toolName: "list_local_files",
      text: [
        `目录：${listResult.queryPath}`,
        `条目数：${listResult.count}${listResult.truncated ? "（已截断）" : ""}`,
        ...listResult.items.slice(0, 60).map((item, index) => `${index + 1}. [${item.type}] ${item.path}`)
      ].join("\n")
    };
  }

  if (action.toolName === "read_text_file") {
    const rawPath = action.arguments.path;
    const rawMax = action.arguments.max_chars;
    const filePath = typeof rawPath === "string" ? rawPath.trim() : "";

    if (!filePath) {
      throw new Error("read_text_file 参数缺少 path");
    }

    const readResult = await callReadTextFileTool({
      path: filePath,
      max_chars: typeof rawMax === "number" && Number.isFinite(rawMax) ? rawMax : undefined
    });

    return {
      toolName: "read_text_file",
      text: [
        `文件：${readResult.path}`,
        `字符数：${readResult.returnedChars}${readResult.truncated ? ` / ${readResult.totalChars}（已截断）` : ""}`,
        "",
        readResult.content
      ].join("\n")
    };
  }

  if (action.toolName === "get_local_access_policy") {
    const policy = await callGetLocalAccessPolicyTool({});
    return {
      toolName: "get_local_access_policy",
      text: [
        `允许访问目录数量：${policy.allowedRootCount}`,
        ...policy.allowedRoots.map((root, index) => `${index + 1}. ${root}`),
        `单次最大读取字符：${policy.maxReadChars}`,
        `单次最大列举条目：${policy.maxListEntries}`,
        `单次最大 PDF 页数：${policy.maxPdfPages}`
      ].join("\n")
    };
  }

  if (action.toolName === "read_office_file") {
    const rawPath = action.arguments.path;
    const rawMax = action.arguments.max_chars;
    const officePath = typeof rawPath === "string" ? rawPath.trim() : "";
    if (!officePath) {
      throw new Error("read_office_file 参数缺少 path");
    }

    const readResult = await callReadOfficeFileTool({
      path: officePath,
      max_chars: typeof rawMax === "number" && Number.isFinite(rawMax) ? rawMax : undefined
    });

    return {
      toolName: "read_office_file",
      text: [
        `Office 文件：${readResult.path}`,
        `格式：${readResult.format}`,
        `字符数：${readResult.returnedChars}${readResult.truncated ? ` / ${readResult.totalChars}（已截断）` : ""}`,
        "",
        readResult.content
      ].join("\n")
    };
  }

  if (action.toolName === "create_text_file") {
    const rawPath = action.arguments.path;
    const rawContent = action.arguments.content;
    const rawOverwrite = action.arguments.overwrite;
    const filePath = typeof rawPath === "string" ? rawPath.trim() : "";
    if (!filePath) {
      throw new Error("create_text_file 参数缺少 path");
    }

    const result = await callCreateTextFileTool({
      path: filePath,
      content: typeof rawContent === "string" ? rawContent : undefined,
      overwrite: typeof rawOverwrite === "boolean" ? rawOverwrite : undefined
    });

    return {
      toolName: "create_text_file",
      text: [`文件路径：${result.path}`, result.overwritten ? "结果：已覆盖" : "结果：已创建"].join("\n")
    };
  }

  if (action.toolName === "write_text_file") {
    const rawPath = action.arguments.path;
    const rawContent = action.arguments.content;
    const rawOverwrite = action.arguments.overwrite;
    const filePath = typeof rawPath === "string" ? rawPath.trim() : "";
    if (!filePath) {
      throw new Error("write_text_file 参数缺少 path");
    }
    if (typeof rawContent !== "string") {
      throw new Error("write_text_file 参数缺少 content");
    }

    const result = await callWriteTextFileTool({
      path: filePath,
      content: rawContent,
      overwrite: typeof rawOverwrite === "boolean" ? rawOverwrite : undefined
    });

    return {
      toolName: "write_text_file",
      text: [`文件路径：${result.path}`, `写入字节：${result.bytes}`].join("\n")
    };
  }

  if (action.toolName === "append_text_file") {
    const rawPath = action.arguments.path;
    const rawContent = action.arguments.content;
    const filePath = typeof rawPath === "string" ? rawPath.trim() : "";
    if (!filePath) {
      throw new Error("append_text_file 参数缺少 path");
    }
    if (typeof rawContent !== "string") {
      throw new Error("append_text_file 参数缺少 content");
    }

    const result = await callAppendTextFileTool({
      path: filePath,
      content: rawContent
    });

    return {
      toolName: "append_text_file",
      text: [`文件路径：${result.path}`, `追加字节：${result.appendedBytes}`].join("\n")
    };
  }

  if (action.toolName === "copy_path") {
    const from = typeof action.arguments.from === "string" ? action.arguments.from.trim() : "";
    const to = typeof action.arguments.to === "string" ? action.arguments.to.trim() : "";
    const overwrite = typeof action.arguments.overwrite === "boolean" ? action.arguments.overwrite : undefined;
    if (!from || !to) {
      throw new Error("copy_path 参数缺少 from/to");
    }

    const result = await callCopyPathTool({ from, to, overwrite });
    return {
      toolName: "copy_path",
      text: [`源路径：${result.from}`, `目标路径：${result.to}`, `类型：${result.copiedType}`].join("\n")
    };
  }

  if (action.toolName === "move_path") {
    const from = typeof action.arguments.from === "string" ? action.arguments.from.trim() : "";
    const to = typeof action.arguments.to === "string" ? action.arguments.to.trim() : "";
    const overwrite = typeof action.arguments.overwrite === "boolean" ? action.arguments.overwrite : undefined;
    if (!from || !to) {
      throw new Error("move_path 参数缺少 from/to");
    }

    const result = await callMovePathTool({ from, to, overwrite });
    return {
      toolName: "move_path",
      text: [`源路径：${result.from}`, `目标路径：${result.to}`, `类型：${result.movedType}`].join("\n")
    };
  }

  if (action.toolName === "rename_path") {
    const pathValue = typeof action.arguments.path === "string" ? action.arguments.path.trim() : "";
    const newName = typeof action.arguments.new_name === "string" ? action.arguments.new_name.trim() : "";
    if (!pathValue || !newName) {
      throw new Error("rename_path 参数缺少 path/new_name");
    }

    const result = await callRenamePathTool({ path: pathValue, new_name: newName });
    return {
      toolName: "rename_path",
      text: [`源路径：${result.from}`, `目标路径：${result.to}`].join("\n")
    };
  }

  if (action.toolName === "delete_path") {
    const pathValue = typeof action.arguments.path === "string" ? action.arguments.path.trim() : "";
    const recursive = typeof action.arguments.recursive === "boolean" ? action.arguments.recursive : undefined;
    const confirm = typeof action.arguments.confirm === "string" ? action.arguments.confirm : undefined;
    if (!pathValue) {
      throw new Error("delete_path 参数缺少 path");
    }

    const result = await callDeletePathTool({ path: pathValue, recursive, confirm });
    return {
      toolName: "delete_path",
      text: [`已删除：${result.path}`, `类型：${result.deletedType}`].join("\n")
    };
  }

  if (action.toolName === "find_local_files") {
    const query = typeof action.arguments.query === "string" ? action.arguments.query.trim() : "";
    const maxEntries =
      typeof action.arguments.max_entries === "number" && Number.isFinite(action.arguments.max_entries)
        ? action.arguments.max_entries
        : undefined;
    const includeDirs = typeof action.arguments.include_dirs === "boolean" ? action.arguments.include_dirs : undefined;
    const roots = Array.isArray(action.arguments.roots)
      ? action.arguments.roots.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : undefined;

    if (!query) {
      throw new Error("find_local_files 参数缺少 query");
    }

    const result = await callFindLocalFilesTool({
      query,
      roots,
      max_entries: maxEntries,
      include_dirs: includeDirs
    });

    return {
      toolName: "find_local_files",
      text: [
        `关键词：${result.query}`,
        `搜索根目录数：${result.rootCount}`,
        `命中数：${result.count}${result.truncated ? "（已截断）" : ""}`,
        ...result.items.slice(0, 50).map((item, index) => `${index + 1}. [${item.type}] ${item.path} (root: ${item.root})`)
      ].join("\n")
    };
  }

  const rawPath = action.arguments.path;
  const rawPages = action.arguments.max_pages;
  const pdfPath = typeof rawPath === "string" ? rawPath.trim() : "";
  if (!pdfPath) {
    throw new Error("extract_pdf_text 参数缺少 path");
  }

  const extractResult = await callExtractPdfTextTool({
    path: pdfPath,
    max_pages: typeof rawPages === "number" && Number.isFinite(rawPages) ? rawPages : undefined
  });

  return {
    toolName: "extract_pdf_text",
    text: [
      `PDF：${extractResult.path}`,
      `页数：${extractResult.returnedPages}/${extractResult.totalPages}${extractResult.truncated ? "（已截断）" : ""}`,
      "",
      extractResult.text
    ].join("\n")
  };
}

async function runAgentWithTools(
  messages: InputMessage[],
  onToolProgress?: (event: AgentToolProgressEvent) => void
): Promise<string | null> {
  const model = await createModel();
  const system = new SystemMessage(getAgentSystemPrompt(new Date()));
  const conversation: BaseMessageLike[] = [...toLangChainMessages(messages)];
  const latestUserText = [...messages].reverse().find((item) => item.role === "user")?.content ?? "";
  const collectedSources: Array<{ title: string; url: string }> = [];
  const collectedSearchProviders: string[] = [];

  for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
    const response = await model.invoke([system, ...conversation]);
    const text = getTextFromContent(response.content).trim();
    if (!text) {
      return null;
    }

    const action = tryParseAgentAction(text);

    console.info(
      JSON.stringify({
        level: "info",
        message: "agent step",
        step,
        raw: text,
        parsedType: action?.type ?? "invalid"
      })
    );

    if (!action) {
      return text;
    }

    if (action.type === "final") {
      return appendSourcesIfNeeded(action.answer, collectedSources, collectedSearchProviders);
    }

    const startedAt = Date.now();
    try {
      onToolProgress?.({
        type: "tool_start",
        step: step + 1,
        toolName: action.toolName,
        args: action.arguments
      });

      const toolResult = await runToolCall(action, latestUserText);
      const durationMs = Date.now() - startedAt;

      onToolProgress?.({
        type: "tool_result",
        step: step + 1,
        toolName: action.toolName,
        ok: true,
        durationMs,
        summary: toolResult.text.slice(0, 180)
      });

      if (toolResult.sources?.length) {
        collectedSources.push(...toolResult.sources);
      }
      if (toolResult.provider) {
        collectedSearchProviders.push(toolResult.provider);
      }

      conversation.push(new AIMessage(text));
      conversation.push(
        new HumanMessage(
          [
            `工具执行结果（${toolResult.toolName}）：`,
            toolResult.text,
            "请基于这个结果继续决策：如果信息已足够，请返回 final；否则返回下一次 tool_call。"
          ].join("\n")
        )
      );
    } catch (error) {
      onToolProgress?.({
        type: "tool_result",
        step: step + 1,
        toolName: action.toolName,
        ok: false,
        durationMs: Date.now() - startedAt,
        summary: error instanceof Error ? error.message : String(error)
      });

      conversation.push(new AIMessage(text));
      conversation.push(
        new HumanMessage(
          `工具执行失败：${error instanceof Error ? error.message : String(error)}。请调整参数重试，或直接返回 final 并说明限制。`
        )
      );
    }
  }

  const finalResponse = await model.invoke([
    system,
    ...conversation,
    new HumanMessage("你已达到最大工具调用步数，请直接输出 final JSON。")
  ]);
  const finalText = getTextFromContent(finalResponse.content).trim();
  const finalAction = tryParseAgentAction(finalText);

  if (finalAction?.type === "final") {
    return appendSourcesIfNeeded(finalAction.answer, collectedSources, collectedSearchProviders);
  }

  return appendSourcesIfNeeded(finalText, collectedSources, collectedSearchProviders);
}

export async function chatWithAssistant(messages: InputMessage[]): Promise<string> {
  const agentResult = await runAgentWithTools(messages);
  if (agentResult && agentResult.trim()) {
    return agentResult;
  }

  const model = await createModel();
  const response = await model.invoke(toLangChainMessages(messages));
  const text = getTextFromContent(response.content).trim();

  if (!text) {
    throw new Error("模型返回了空内容");
  }

  return text;
}

export async function* streamChatWithAssistant(
  messages: InputMessage[],
  options?: { onToolProgress?: (event: AgentToolProgressEvent) => void }
): AsyncGenerator<string> {
  const agentResult = await runAgentWithTools(messages, options?.onToolProgress);
  if (agentResult && agentResult.trim()) {
    yield* streamTextByChunks(agentResult);
    return;
  }

  const model = await createModel();
  const stream = await model.stream(toLangChainMessages(messages));

  for await (const chunk of stream) {
    const delta = getTextFromContent(chunk.content);
    if (delta) {
      yield delta;
    }
  }
}
