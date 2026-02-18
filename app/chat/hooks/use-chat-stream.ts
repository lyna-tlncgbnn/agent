"use client";

import { type Dispatch, type SetStateAction, useCallback, useMemo, useState } from "react";
import type { ChatMessage, ChatSession, Role, StreamEvent, ToolProgressItem } from "@/app/chat/types";
import { createMessage, updateMessageById } from "@/app/chat/utils/messages";

type UseChatStreamInput = {
  activeSessionId: string | null;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  upsertSessionMessages: (sessionId: string, updater: SetStateAction<ChatMessage[]>) => void;
  setActiveSessionId: (id: string | null) => void;
  refreshSessions: () => Promise<ChatSession[]>;
  setStatus: (value: string) => void;
};

export function useChatStream({
  activeSessionId,
  messages,
  setMessages,
  upsertSessionMessages,
  setActiveSessionId,
  refreshSessions,
  setStatus
}: UseChatStreamInput) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [toolProgress, setToolProgress] = useState<ToolProgressItem[]>([]);

  const canSubmit = useMemo(() => input.trim().length > 0 && !busy, [busy, input]);

  const createSessionIfNeeded = useCallback(async (): Promise<{ sessionId: string; isNew: boolean }> => {
    if (activeSessionId) {
      return { sessionId: activeSessionId, isNew: false };
    }

    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "新对话" })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || "创建会话失败");
    }

    const created = data?.item as ChatSession | undefined;
    if (!created?.id) {
      throw new Error("创建会话失败：返回数据不完整");
    }

    await refreshSessions();
    return { sessionId: created.id, isNew: true };
  }, [activeSessionId, refreshSessions]);

  const persistMessage = useCallback(async (sessionId: string, role: Role, content: string) => {
    if (!content.trim()) return;

    const response = await fetch(`/api/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, content })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error || "写入消息失败");
    }
  }, []);

  const streamAssistantReply = useCallback(async (
    sessionId: string,
    conversation: Array<{ role: Role; content: string }>,
    assistantId: string
  ): Promise<string> => {
    setToolProgress([]);

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversation })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error || "聊天请求失败");
    }

    if (!response.body) {
      throw new Error("聊天流响应为空");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let pendingDelta = "";
    let fullContent = "";
    let frameId: number | null = null;
    let finished = false;
    let shouldClearStatusOnDone = true;

    const flushDelta = () => {
      if (!pendingDelta) {
        frameId = null;
        return;
      }

      const delta = pendingDelta;
      pendingDelta = "";
      frameId = null;
      fullContent += delta;

      upsertSessionMessages(sessionId, (prev) =>
        updateMessageById(prev, assistantId, (message) => ({
          ...message,
          content: `${message.content}${delta}`
        }))
      );
    };

    const queueDelta = (delta: string) => {
      pendingDelta += delta;
      if (frameId === null) {
        frameId = requestAnimationFrame(flushDelta);
      }
    };

    const finishStream = (errorMessage?: string) => {
      if (finished) return;
      finished = true;

      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      flushDelta();

      upsertSessionMessages(sessionId, (prev) =>
        updateMessageById(prev, assistantId, (message) => ({
          ...message,
          streaming: false,
          content: errorMessage && !message.content.trim() ? `生成失败：${errorMessage}` : message.content
        }))
      );
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let eventBoundary = buffer.indexOf("\n\n");
      while (eventBoundary !== -1) {
        const rawEvent = buffer.slice(0, eventBoundary);
        buffer = buffer.slice(eventBoundary + 2);

        const dataLine = rawEvent
          .split("\n")
          .find((line) => line.startsWith("data: "));

        if (dataLine) {
          const payload = dataLine.slice(6);
          try {
            const event = JSON.parse(payload) as StreamEvent;

            if (event.type === "delta") {
              queueDelta(event.delta);
            }

            if (event.type === "tool_start") {
              setToolProgress((prev) => {
                const id = `step-${event.step}-${event.toolName}`;
                const withoutCurrent = prev.filter((item) => item.id !== id);
                return [
                  ...withoutCurrent,
                  {
                    id,
                    step: event.step,
                    toolName: event.toolName,
                    status: "running"
                  }
                ];
              });
            }

            if (event.type === "tool_result") {
              setToolProgress((prev) => {
                const id = `step-${event.step}-${event.toolName}`;
                const nextItem: ToolProgressItem = {
                  id,
                  step: event.step,
                  toolName: event.toolName,
                  status: event.ok ? "success" : "error",
                  summary: event.summary
                };
                const exists = prev.some((item) => item.id === id);
                return exists ? prev.map((item) => (item.id === id ? nextItem : item)) : [...prev, nextItem];
              });
            }

            if (event.type === "done") {
              finishStream();
              setToolProgress([]);
              if (shouldClearStatusOnDone) {
                setStatus("");
              }
            }

            if (event.type === "notion_saved") {
              shouldClearStatusOnDone = false;
              setStatus(`Auto-saved to Notion: ${event.pageUrl}`);
            }

            if (event.type === "notion_save_error") {
              shouldClearStatusOnDone = false;
              setStatus(`Auto-save to Notion failed: ${event.message}`);
            }

            if (event.type === "error") {
              const message = event.message || "聊天请求失败";
              finishStream(message);
              setToolProgress([]);
              setStatus(message);
            }
          } catch {
            setStatus("流式事件解析失败");
          }
        }

        eventBoundary = buffer.indexOf("\n\n");
      }
    }

    finishStream();
    return fullContent;
  }, [setStatus, upsertSessionMessages]);

  const ask = useCallback(async () => {
    const question = input.trim();
    if (!question || busy) return;

    const userMessage = createMessage("user", question);
    const assistantMessage = createMessage("assistant", "", true);

    const conversationForModel = [...messages, userMessage]
      .filter((message) => message.content.trim().length > 0)
      .map((message) => ({
        role: message.role,
        content: message.content
      }));

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
    setBusy(true);
    setToolProgress([]);
    setStatus("AI 正在生成...");

    let targetSessionId: string | null = null;

    try {
      const { sessionId, isNew } = await createSessionIfNeeded();
      targetSessionId = sessionId;
      const seededMessages = [...messages, userMessage, assistantMessage];

      upsertSessionMessages(sessionId, seededMessages);
      if (isNew) {
        setActiveSessionId(sessionId);
      }

      await persistMessage(sessionId, "user", question);
      const finalContent = await streamAssistantReply(sessionId, conversationForModel, assistantMessage.id);

      if (finalContent.trim()) {
        await persistMessage(sessionId, "assistant", finalContent);
      }

      await refreshSessions();
    } catch (error) {
      const message = error instanceof Error ? error.message : "发生未知错误";
      if (targetSessionId) {
        upsertSessionMessages(targetSessionId, (prev) =>
          updateMessageById(prev, assistantMessage.id, (item) => ({
            ...item,
            streaming: false,
            content: item.content.trim() ? item.content : `生成失败：${message}`
          }))
        );
      } else {
        setMessages((prev) =>
          updateMessageById(prev, assistantMessage.id, (item) => ({
            ...item,
            streaming: false,
            content: item.content.trim() ? item.content : `生成失败：${message}`
          }))
        );
      }
      setStatus(message);
      setToolProgress([]);
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    createSessionIfNeeded,
    input,
    messages,
    persistMessage,
    refreshSessions,
    setActiveSessionId,
    setMessages,
    setStatus,
    streamAssistantReply,
    upsertSessionMessages
  ]);

  return {
    input,
    busy,
    canSubmit,
    setInput,
    ask,
    toolProgress
  };
}
