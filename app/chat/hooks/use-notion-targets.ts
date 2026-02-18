"use client";

import { useCallback, useState } from "react";
import type { ChatMessage, ParentOption, ParentsApiResponse, SaveDraft } from "@/app/chat/types";

type UseNotionTargetsInput = {
  messages: ChatMessage[];
  setStatus: (value: string) => void;
};

export function useNotionTargets({ messages, setStatus }: UseNotionTargetsInput) {
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null);
  const [saveDraft, setSaveDraft] = useState<SaveDraft | null>(null);
  const [parentQuery, setParentQuery] = useState("");
  const [parentLoading, setParentLoading] = useState(false);
  const [parentOptions, setParentOptions] = useState<ParentOption[]>([]);
  const [defaultParent, setDefaultParent] = useState<ParentOption | null>(null);

  const loadParentOptions = useCallback(async (query: string): Promise<ParentsApiResponse | null> => {
    setParentLoading(true);

    try {
      const response = await fetch(`/api/notion/parents?q=${encodeURIComponent(query)}`, {
        method: "GET"
      });
      const data = (await response.json()) as ParentsApiResponse;

      if (!response.ok) {
        throw new Error(data?.error || "获取页面列表失败");
      }

      const options = Array.isArray(data.items) ? data.items : [];
      setParentOptions(options);
      setDefaultParent(data.defaultParent ?? null);
      return data;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "获取页面列表失败");
      setParentOptions([]);
      setDefaultParent(null);
      return null;
    } finally {
      setParentLoading(false);
    }
  }, [setStatus]);

  const openSaveEditor = useCallback((messageId: string, content: string) => {
    if (!content.trim()) {
      setStatus("当前回答内容为空，无法保存");
      return;
    }

    setSaveDraft({
      messageId,
      title: `AI 回答 - ${new Date().toLocaleString()}`,
      selectedParentPageId: ""
    });
    setParentQuery("");
    setParentOptions([]);
    setDefaultParent(null);

    void loadParentOptions("").then((data) => {
      const defaultId = data?.defaultParent?.id || "";
      if (!defaultId) return;
      setSaveDraft((prev) =>
        prev && prev.messageId === messageId
          ? { ...prev, selectedParentPageId: defaultId }
          : prev
      );
    });
  }, [loadParentOptions, setStatus]);

  const cancelSaveEditor = useCallback(() => {
    setSaveDraft(null);
  }, []);

  const updateSaveTitle = useCallback((title: string) => {
    setSaveDraft((prev) => (prev ? { ...prev, title } : prev));
  }, []);

  const updateSelectedParentId = useCallback((selectedParentPageId: string) => {
    setSaveDraft((prev) =>
      prev ? { ...prev, selectedParentPageId } : prev
    );
  }, []);

  const submitSaveDraft = useCallback(async () => {
    if (!saveDraft) return;

    const targetMessage = messages.find((message) => message.id === saveDraft.messageId);
    if (!targetMessage) {
      setStatus("保存失败：未找到对应回答");
      return;
    }

    if (!saveDraft.selectedParentPageId.trim()) {
      setStatus("请先选择保存目标页面");
      return;
    }

    setSavingMessageId(saveDraft.messageId);
    setStatus("正在保存到 Notion...");

    try {
      const response = await fetch("/api/notion/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: saveDraft.title,
          answer: targetMessage.content,
          sourceType: "chat_answer",
          parentPageId: saveDraft.selectedParentPageId
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "保存失败");
      }

      setStatus(`已保存到 Notion: ${data.pageUrl}`);
      setSaveDraft(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSavingMessageId(null);
    }
  }, [messages, saveDraft, setStatus]);

  const getOptionLabel = useCallback((item: ParentOption): string => {
    if (item.isDefault || (defaultParent && item.id === defaultParent.id)) {
      return `${item.title}（默认）`;
    }
    return item.title;
  }, [defaultParent]);

  return {
    saveDraft,
    savingMessageId,
    parentQuery,
    parentLoading,
    parentOptions,
    setParentQuery,
    loadParentOptions,
    openSaveEditor,
    cancelSaveEditor,
    updateSaveTitle,
    updateSelectedParentId,
    submitSaveDraft,
    getOptionLabel
  };
}
