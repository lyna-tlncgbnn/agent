"use client";

import dynamic from "next/dynamic";
import { memo } from "react";
import { Save } from "lucide-react";
import type { ChatMessage, ToolProgressItem } from "@/app/chat/types";

const MarkdownContent = dynamic(() => import("@/app/components/chat-markdown"), {
  ssr: false,
  loading: () => <span />
});

type ChatMessageItemProps = {
  message: ChatMessage;
  saving: boolean;
  toolProgress?: ToolProgressItem[];
  onOpenSaveEditor: (messageId: string, content: string) => void;
};

export const ChatMessageItem = memo(function ChatMessageItem({
  message,
  saving,
  toolProgress = [],
  onOpenSaveEditor
}: ChatMessageItemProps) {
  const providerMatch = message.content.match(/(?:^|\n)搜索源：([^\n]+)/);
  const searchProvider = providerMatch?.[1]?.trim() || "";
  const renderContent = searchProvider
    ? message.content.replace(/\n?搜索源：[^\n]+\n?/g, "\n").trim()
    : message.content;

  return (
    <article className={`chat-row ${message.role}`}>
      <div className={`bubble ${message.role}`}>
        {message.role === "assistant" && !message.streaming && searchProvider ? (
          <div className="search-provider-badge">搜索源: {searchProvider}</div>
        ) : null}

        <div className="message-markdown">
          <MarkdownContent content={renderContent || " "} />
          {message.streaming ? <div className="streaming-placeholder">正在生成答案...</div> : null}
          {message.streaming && toolProgress.length > 0 ? (
            <div className="tool-progress-panel" aria-live="polite">
              {toolProgress.map((item) => (
                <div key={item.id} className={`tool-progress-item ${item.status}`}>
                  <span className="tool-progress-title">Step {item.step}: {item.toolName}</span>
                  <span className="tool-progress-summary">
                    {item.status === "running"
                      ? "正在执行..."
                      : item.summary || (item.status === "success" ? "执行完成" : "执行失败")}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {message.role === "assistant" && !message.streaming ? (
          <div className="assistant-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => onOpenSaveEditor(message.id, renderContent)}
              disabled={saving}
              title="保存到 Notion"
            >
              <Save size={16} strokeWidth={2.4} />
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
});
