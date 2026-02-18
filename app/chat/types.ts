export type Role = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  streaming?: boolean;
};

export type ChatSession = {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
};

export type SaveDraft = {
  messageId: string;
  title: string;
  selectedParentPageId: string;
};

export type RenameDraft = {
  sessionId: string;
  title: string;
};

export type ParentOption = {
  id: string;
  title: string;
  type?: "default_parent" | "child_page";
  isDefault?: boolean;
};

export type ParentsApiResponse = {
  defaultParent?: ParentOption;
  items?: ParentOption[];
  error?: string;
};

export type StreamEvent =
  | { type: "delta"; delta: string }
  | { type: "done" }
  | { type: "tool_start"; step: number; toolName: string; args: Record<string, unknown> }
  | { type: "tool_result"; step: number; toolName: string; ok: boolean; durationMs: number; summary: string }
  | { type: "notion_saved"; pageUrl: string; title: string }
  | { type: "notion_save_error"; message: string }
  | { type: "error"; message: string };

export type ToolProgressItem = {
  id: string;
  step: number;
  toolName: string;
  status: "running" | "success" | "error";
  summary?: string;
};
