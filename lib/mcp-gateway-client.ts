import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export type SaveChatAnswerToolInput = {
  title?: string;
  answer: string;
  sourceType?: "chat_answer" | "bookmark_article";
  parentPageId?: string;
};

export type SaveChatAnswerToolResult = {
  pageId: string;
  pageUrl: string;
  parentPageId: string;
  markdown: string;
  sourceType: "chat_answer" | "bookmark_article";
};

export type ListNotionTargetsToolInput = {
  query?: string;
};

export type NotionTargetOption = {
  id: string;
  title: string;
  type: "default_parent" | "child_page";
  isDefault: boolean;
};

export type ListNotionTargetsToolResult = {
  defaultParent: NotionTargetOption;
  items: NotionTargetOption[];
};

export type GetWeatherToolInput = {
  query: string;
  days?: number;
};

export type GetWeatherToolResult = {
  provider: string;
  query: string;
  location: string;
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    time: string;
    weatherText: string;
    temperatureC: number | null;
    apparentTemperatureC: number | null;
    humidity: number | null;
    precipitationMm: number | null;
    windSpeedKmh: number | null;
  };
};

export type WebSearchToolInput = {
  query: string;
  max_results?: number;
};

export type WebSearchToolResult = {
  provider: string;
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  sources: Array<{
    title: string;
    url: string;
  }>;
};

export type ListLocalFilesToolInput = {
  path: string;
  recursive?: boolean;
  max_entries?: number;
};

export type ListLocalFilesToolResult = {
  root: string;
  queryPath: string;
  recursive: boolean;
  truncated: boolean;
  count: number;
  items: Array<{
    path: string;
    name: string;
    type: "file" | "dir";
    size: number;
    updatedAt: string;
  }>;
};

export type ReadTextFileToolInput = {
  path: string;
  max_chars?: number;
};

export type ReadTextFileToolResult = {
  path: string;
  truncated: boolean;
  totalChars: number;
  returnedChars: number;
  content: string;
};

export type ExtractPdfTextToolInput = {
  path: string;
  max_pages?: number;
};

export type ExtractPdfTextToolResult = {
  path: string;
  totalPages: number;
  returnedPages: number;
  truncated: boolean;
  text: string;
};

export type ReadOfficeFileToolInput = {
  path: string;
  max_chars?: number;
};

export type ReadOfficeFileToolResult = {
  path: string;
  format: "docx" | "xlsx" | "pptx";
  truncated: boolean;
  totalChars: number;
  returnedChars: number;
  content: string;
};

export type GetLocalAccessPolicyToolInput = Record<string, never>;

export type GetLocalAccessPolicyToolResult = {
  allowedRoots: string[];
  allowedRootCount: number;
  maxReadChars: number;
  maxListEntries: number;
  maxPdfPages: number;
};

export type CreateTextFileToolInput = {
  path: string;
  content?: string;
  overwrite?: boolean;
};

export type CreateTextFileToolResult = {
  path: string;
  created: boolean;
  overwritten: boolean;
  bytes: number;
};

export type WriteTextFileToolInput = {
  path: string;
  content: string;
  overwrite?: boolean;
};

export type WriteTextFileToolResult = {
  path: string;
  overwritten: boolean;
  bytes: number;
};

export type AppendTextFileToolInput = {
  path: string;
  content: string;
};

export type AppendTextFileToolResult = {
  path: string;
  appendedBytes: number;
};

export type CopyPathToolInput = {
  from: string;
  to: string;
  overwrite?: boolean;
};

export type CopyPathToolResult = {
  from: string;
  to: string;
  copiedType: "file" | "dir";
  overwritten: boolean;
};

export type MovePathToolInput = {
  from: string;
  to: string;
  overwrite?: boolean;
};

export type MovePathToolResult = {
  from: string;
  to: string;
  movedType: "file" | "dir";
  overwritten: boolean;
};

export type RenamePathToolInput = {
  path: string;
  new_name: string;
};

export type RenamePathToolResult = {
  from: string;
  to: string;
  renamedType: "file" | "dir";
};

export type DeletePathToolInput = {
  path: string;
  recursive?: boolean;
  confirm?: string;
};

export type DeletePathToolResult = {
  path: string;
  deletedType: "file" | "dir";
};

export type FindLocalFilesToolInput = {
  query: string;
  roots?: string[];
  max_entries?: number;
  include_dirs?: boolean;
};

export type FindLocalFilesToolResult = {
  query: string;
  rootCount: number;
  count: number;
  truncated: boolean;
  items: Array<{
    root: string;
    path: string;
    name: string;
    type: "file" | "dir";
  }>;
};

type TextContentItem = {
  type: "text";
  text: string;
};

function getGatewayDistPath(): string {
  return path.join(process.cwd(), "mcp-gateway", "dist", "server.js");
}

function extractErrorMessage(content: unknown): string {
  if (!Array.isArray(content)) {
    return "Gateway tool 执行失败";
  }

  const textItem = content.find((item): item is TextContentItem => {
    return (
      typeof item === "object" &&
      item !== null &&
      "type" in item &&
      "text" in item &&
      (item as { type?: unknown }).type === "text" &&
      typeof (item as { text?: unknown }).text === "string"
    );
  });

  return textItem?.text || "Gateway tool 执行失败";
}

async function callGatewayTool(toolName: string, args: Record<string, unknown>) {
  const client = new Client(
    { name: "main-app-mcp-client", version: "0.1.0" },
    { capabilities: {} }
  );

  // 每次请求独立拉起一个 stdio MCP 子进程，避免和常驻端口耦合。
  const transport = new StdioClientTransport({
    command: "node",
    args: [getGatewayDistPath()],
    cwd: process.cwd(),
    env: {
      ...process.env,
      GATEWAY_HEALTH_PORT: "0"
    }
  });

  try {
    await client.connect(transport);

    const response = await client.callTool({
      name: toolName,
      arguments: args
    });

    if (response.isError) {
      throw new Error(extractErrorMessage(response.content));
    }

    return response.structuredContent;
  } finally {
    await client.close();
  }
}

export async function callSaveChatAnswerTool(input: SaveChatAnswerToolInput): Promise<SaveChatAnswerToolResult> {
  const data = await callGatewayTool("save_chat_answer", input);

  if (!data || typeof data !== "object") {
    throw new Error("Gateway 返回格式异常：缺少 structuredContent");
  }

  const result = data as Partial<SaveChatAnswerToolResult>;
  if (!result.pageId || !result.pageUrl || !result.markdown || !result.parentPageId || !result.sourceType) {
    throw new Error("Gateway 返回字段不完整");
  }

  return result as SaveChatAnswerToolResult;
}

export async function callListNotionTargetsTool(
  input: ListNotionTargetsToolInput
): Promise<ListNotionTargetsToolResult> {
  const data = await callGatewayTool("list_notion_targets", input);

  if (!data || typeof data !== "object") {
    throw new Error("Gateway 返回格式异常：缺少 structuredContent");
  }

  const result = data as Partial<ListNotionTargetsToolResult>;
  if (!result.defaultParent || !Array.isArray(result.items)) {
    throw new Error("Gateway 返回字段不完整");
  }

  return result as ListNotionTargetsToolResult;
}

export async function callGetWeatherTool(input: GetWeatherToolInput): Promise<GetWeatherToolResult> {
  const data = await callGatewayTool("get_weather", input);

  if (!data || typeof data !== "object") {
    throw new Error("Gateway 返回格式异常：缺少 structuredContent");
  }

  const result = data as Partial<GetWeatherToolResult>;
  if (!result.location || !result.current || !result.provider) {
    throw new Error("Gateway 返回字段不完整");
  }

  return result as GetWeatherToolResult;
}

export async function callWebSearchTool(input: WebSearchToolInput): Promise<WebSearchToolResult> {
  const data = await callGatewayTool("web_search", input);

  if (!data || typeof data !== "object") {
    throw new Error("Gateway 返回格式异常：缺少 structuredContent");
  }

  const result = data as Partial<WebSearchToolResult>;
  if (!result.provider || !result.query || !Array.isArray(result.results)) {
    throw new Error("Gateway 返回字段不完整");
  }

  return result as WebSearchToolResult;
}

export async function callListLocalFilesTool(input: ListLocalFilesToolInput): Promise<ListLocalFilesToolResult> {
  const data = await callGatewayTool("list_local_files", input);

  if (!data || typeof data !== "object") {
    throw new Error("Gateway 返回格式异常：缺少 structuredContent");
  }

  const result = data as Partial<ListLocalFilesToolResult>;
  if (!result.queryPath || !Array.isArray(result.items)) {
    throw new Error("Gateway 返回字段不完整");
  }

  return result as ListLocalFilesToolResult;
}

export async function callReadTextFileTool(input: ReadTextFileToolInput): Promise<ReadTextFileToolResult> {
  const data = await callGatewayTool("read_text_file", input);

  if (!data || typeof data !== "object") {
    throw new Error("Gateway 返回格式异常：缺少 structuredContent");
  }

  const result = data as Partial<ReadTextFileToolResult>;
  if (!result.path || typeof result.content !== "string") {
    throw new Error("Gateway 返回字段不完整");
  }

  return result as ReadTextFileToolResult;
}

export async function callExtractPdfTextTool(input: ExtractPdfTextToolInput): Promise<ExtractPdfTextToolResult> {
  const data = await callGatewayTool("extract_pdf_text", input);

  if (!data || typeof data !== "object") {
    throw new Error("Gateway 返回格式异常：缺少 structuredContent");
  }

  const result = data as Partial<ExtractPdfTextToolResult>;
  if (!result.path || typeof result.text !== "string") {
    throw new Error("Gateway 返回字段不完整");
  }

  return result as ExtractPdfTextToolResult;
}

export async function callReadOfficeFileTool(input: ReadOfficeFileToolInput): Promise<ReadOfficeFileToolResult> {
  const data = await callGatewayTool("read_office_file", input);

  if (!data || typeof data !== "object") {
    throw new Error("Gateway 返回格式异常：缺少 structuredContent");
  }

  const result = data as Partial<ReadOfficeFileToolResult>;
  if (!result.path || typeof result.content !== "string" || !result.format) {
    throw new Error("Gateway 返回字段不完整");
  }

  return result as ReadOfficeFileToolResult;
}

export async function callGetLocalAccessPolicyTool(
  input: GetLocalAccessPolicyToolInput = {}
): Promise<GetLocalAccessPolicyToolResult> {
  const data = await callGatewayTool("get_local_access_policy", input);

  if (!data || typeof data !== "object") {
    throw new Error("Gateway 返回格式异常：缺少 structuredContent");
  }

  const result = data as Partial<GetLocalAccessPolicyToolResult>;
  if (!Array.isArray(result.allowedRoots) || typeof result.allowedRootCount !== "number") {
    throw new Error("Gateway 返回字段不完整");
  }

  return result as GetLocalAccessPolicyToolResult;
}

export async function callCreateTextFileTool(input: CreateTextFileToolInput): Promise<CreateTextFileToolResult> {
  const data = await callGatewayTool("create_text_file", input);
  if (!data || typeof data !== "object") {
    throw new Error("Gateway 返回格式异常：缺少 structuredContent");
  }
  const result = data as Partial<CreateTextFileToolResult>;
  if (!result.path || typeof result.bytes !== "number") {
    throw new Error("Gateway 返回字段不完整");
  }
  return result as CreateTextFileToolResult;
}

export async function callWriteTextFileTool(input: WriteTextFileToolInput): Promise<WriteTextFileToolResult> {
  const data = await callGatewayTool("write_text_file", input);
  if (!data || typeof data !== "object") {
    throw new Error("Gateway 返回格式异常：缺少 structuredContent");
  }
  const result = data as Partial<WriteTextFileToolResult>;
  if (!result.path || typeof result.bytes !== "number") {
    throw new Error("Gateway 返回字段不完整");
  }
  return result as WriteTextFileToolResult;
}

export async function callAppendTextFileTool(input: AppendTextFileToolInput): Promise<AppendTextFileToolResult> {
  const data = await callGatewayTool("append_text_file", input);
  if (!data || typeof data !== "object") {
    throw new Error("Gateway 返回格式异常：缺少 structuredContent");
  }
  const result = data as Partial<AppendTextFileToolResult>;
  if (!result.path || typeof result.appendedBytes !== "number") {
    throw new Error("Gateway 返回字段不完整");
  }
  return result as AppendTextFileToolResult;
}

export async function callCopyPathTool(input: CopyPathToolInput): Promise<CopyPathToolResult> {
  const data = await callGatewayTool("copy_path", input);
  if (!data || typeof data !== "object") {
    throw new Error("Gateway 返回格式异常：缺少 structuredContent");
  }
  const result = data as Partial<CopyPathToolResult>;
  if (!result.from || !result.to || !result.copiedType) {
    throw new Error("Gateway 返回字段不完整");
  }
  return result as CopyPathToolResult;
}

export async function callMovePathTool(input: MovePathToolInput): Promise<MovePathToolResult> {
  const data = await callGatewayTool("move_path", input);
  if (!data || typeof data !== "object") {
    throw new Error("Gateway 返回格式异常：缺少 structuredContent");
  }
  const result = data as Partial<MovePathToolResult>;
  if (!result.from || !result.to || !result.movedType) {
    throw new Error("Gateway 返回字段不完整");
  }
  return result as MovePathToolResult;
}

export async function callRenamePathTool(input: RenamePathToolInput): Promise<RenamePathToolResult> {
  const data = await callGatewayTool("rename_path", input);
  if (!data || typeof data !== "object") {
    throw new Error("Gateway 返回格式异常：缺少 structuredContent");
  }
  const result = data as Partial<RenamePathToolResult>;
  if (!result.from || !result.to || !result.renamedType) {
    throw new Error("Gateway 返回字段不完整");
  }
  return result as RenamePathToolResult;
}

export async function callDeletePathTool(input: DeletePathToolInput): Promise<DeletePathToolResult> {
  const data = await callGatewayTool("delete_path", input);
  if (!data || typeof data !== "object") {
    throw new Error("Gateway 返回格式异常：缺少 structuredContent");
  }
  const result = data as Partial<DeletePathToolResult>;
  if (!result.path || !result.deletedType) {
    throw new Error("Gateway 返回字段不完整");
  }
  return result as DeletePathToolResult;
}

export async function callFindLocalFilesTool(input: FindLocalFilesToolInput): Promise<FindLocalFilesToolResult> {
  const data = await callGatewayTool("find_local_files", input);
  if (!data || typeof data !== "object") {
    throw new Error("Gateway 返回格式异常：缺少 structuredContent");
  }
  const result = data as Partial<FindLocalFilesToolResult>;
  if (!result.query || typeof result.count !== "number" || !Array.isArray(result.items)) {
    throw new Error("Gateway 返回字段不完整");
  }
  return result as FindLocalFilesToolResult;
}
