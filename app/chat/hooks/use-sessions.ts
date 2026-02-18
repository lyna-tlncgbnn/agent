"use client";

import { type SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, ChatSession, RenameDraft, Role } from "@/app/chat/types";

type UseSessionsInput = {
  setStatus: (value: string) => void;
};

type LoadedMessage = {
  id: string;
  role: Role;
  content: string;
};

export function useSessions({ setStatus }: UseSessionsInput) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [creatingSession] = useState(false);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [messages, setMessagesState] = useState<ChatMessage[]>([]);
  const [renameDraft, setRenameDraft] = useState<RenameDraft | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const messageCacheRef = useRef<Record<string, ChatMessage[]>>({});
  const activeSessionIdRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const setMessages = useCallback((updater: SetStateAction<ChatMessage[]>) => {
    setMessagesState((prev) => {
      const next = typeof updater === "function"
        ? (updater as (value: ChatMessage[]) => ChatMessage[])(prev)
        : updater;

      const currentSessionId = activeSessionIdRef.current;
      if (currentSessionId) {
        messageCacheRef.current[currentSessionId] = next;
      }
      return next;
    });
  }, []);

  const upsertSessionMessages = useCallback(
    (sessionId: string, updater: SetStateAction<ChatMessage[]>) => {
      const previous = messageCacheRef.current[sessionId] ?? [];
      const next = typeof updater === "function"
        ? (updater as (value: ChatMessage[]) => ChatMessage[])(previous)
        : updater;

      messageCacheRef.current[sessionId] = next;

      if (activeSessionIdRef.current === sessionId) {
        setMessagesState(next);
      }
    },
    []
  );

  const refreshSessions = useCallback(async () => {
    const response = await fetch("/api/sessions", { method: "GET" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || "读取会话失败");
    }

    const items = (Array.isArray(data?.items) ? data.items : []) as ChatSession[];
    setSessions(items);
    return items;
  }, []);

  const startDraftSession = useCallback(() => {
    const currentSessionId = activeSessionIdRef.current;
    if (currentSessionId) {
      messageCacheRef.current[currentSessionId] = messagesRef.current;
    }
    setActiveSessionId(null);
    setMessagesState([]);
    setStatus("");
    setRenameDraft(null);
  }, [setStatus]);

  const switchSession = useCallback((nextSessionId: string) => {
    const currentSessionId = activeSessionIdRef.current;
    if (currentSessionId) {
      messageCacheRef.current[currentSessionId] = messagesRef.current;
    }

    setActiveSessionId(nextSessionId);

    const cachedMessages = messageCacheRef.current[nextSessionId];
    if (cachedMessages) {
      setMessagesState(cachedMessages);
      setStatus("");
      return;
    }

    setMessagesState([]);
  }, [setStatus]);

  const openRenameEditor = useCallback((sessionId: string, currentTitle: string) => {
    setRenameDraft({
      sessionId,
      title: currentTitle || "新对话"
    });
  }, []);

  const cancelRenameEditor = useCallback(() => {
    setRenameDraft(null);
  }, []);

  const updateRenameDraftTitle = useCallback((title: string) => {
    setRenameDraft((prev) => (prev ? { ...prev, title } : prev));
  }, []);

  const submitRenameDraft = useCallback(async () => {
    if (!renameDraft) return;

    const normalized = renameDraft.title.trim();
    if (!normalized) {
      setStatus("会话标题不能为空");
      return;
    }

    setRenamingSessionId(renameDraft.sessionId);
    try {
      const response = await fetch(`/api/sessions/${renameDraft.sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: normalized })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "重命名会话失败");
      }

      await refreshSessions();
      setRenameDraft(null);
      setStatus("会话已重命名");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "重命名会话失败");
    } finally {
      setRenamingSessionId(null);
    }
  }, [refreshSessions, renameDraft, setStatus]);

  const removeSession = useCallback(async (sessionId: string) => {
    setDeletingSessionId(sessionId);
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "删除会话失败");
      }

      const nextSessions = await refreshSessions();
      if (activeSessionId === sessionId) {
        const nextSessionId = nextSessions[0]?.id || null;
        setActiveSessionId(nextSessionId);
        if (nextSessionId && messageCacheRef.current[nextSessionId]) {
          setMessagesState(messageCacheRef.current[nextSessionId]);
        } else {
          setMessagesState([]);
        }
      }
      setStatus("会话已删除");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "删除会话失败");
    } finally {
      setDeletingSessionId(null);
    }
  }, [activeSessionId, refreshSessions, setStatus]);

  useEffect(() => {
    try {
      [
        "chatMessages",
        "chatHistory",
        "conversation",
        "langchain-notion-assistant:messages",
        "langchain-notion-assistant:sessions",
        "langchain-notion-assistant:active-session"
      ].forEach((key) => localStorage.removeItem(key));
    } catch {
      // Ignore browser restriction scenarios.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const items = await refreshSessions();
        if (!active) return;

        const rememberedSessionId = (() => {
          try {
            return sessionStorage.getItem("activeSessionId");
          } catch {
            return null;
          }
        })();

        const matched = rememberedSessionId
          ? items.find((session) => session.id === rememberedSessionId)
          : null;

        setActiveSessionId((matched || items[0])?.id || null);
      } catch (error) {
        if (!active) return;
        setStatus(error instanceof Error ? error.message : "初始化会话失败");
      }
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, [refreshSessions, setStatus]);

  useEffect(() => {
    if (!activeSessionId || !hydrated) return;

    try {
      sessionStorage.setItem("activeSessionId", activeSessionId);
    } catch {
      // Ignore browser restriction scenarios.
    }
  }, [activeSessionId, hydrated]);

  useEffect(() => {
    let active = true;

    async function loadMessages(sessionId: string) {
      const cachedMessages = messageCacheRef.current[sessionId];
      if (cachedMessages) {
        setMessagesState(cachedMessages);
        setStatus("");
        return;
      }

      try {
        const response = await fetch(`/api/sessions/${sessionId}/messages`, { method: "GET" });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "读取消息失败");
        }

        if (!active) return;
        const items = (Array.isArray(data?.items) ? data.items : []) as LoadedMessage[];
        const normalizedMessages = items.map((item) => ({ ...item, streaming: false }));
        messageCacheRef.current[sessionId] = normalizedMessages;
        setMessagesState(normalizedMessages);
        setStatus("");
      } catch (error) {
        if (!active) return;
        setMessagesState([]);
        setStatus(error instanceof Error ? error.message : "读取消息失败");
      }
    }

    if (activeSessionId) {
      void loadMessages(activeSessionId);
    } else {
      setMessagesState([]);
    }

    return () => {
      active = false;
    };
  }, [activeSessionId, setStatus]);

  return {
    sessions,
    activeSessionId,
    creatingSession,
    renamingSessionId,
    deletingSessionId,
    messages,
    renameDraft,
    setActiveSessionId,
    setMessages,
    upsertSessionMessages,
    refreshSessions,
    startDraftSession,
    switchSession,
    openRenameEditor,
    cancelRenameEditor,
    updateRenameDraftTitle,
    submitRenameDraft,
    removeSession
  };
}
