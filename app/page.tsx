"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ChatComposer } from "@/app/chat/components/chat-composer";
import { ChatMessageItem } from "@/app/chat/components/chat-message-item";
import { RenameSessionModal } from "@/app/chat/components/rename-session-modal";
import { SaveToNotionModal } from "@/app/chat/components/save-to-notion-modal";
import { SessionSidebar } from "@/app/chat/components/session-sidebar";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";
import { ModalOverlay } from "@/app/components/ui/modal-overlay";
import { SettingsPanel } from "@/app/settings/settings-panel";
import { useChatStream } from "@/app/chat/hooks/use-chat-stream";
import { useNotionTargets } from "@/app/chat/hooks/use-notion-targets";
import { useSessions } from "@/app/chat/hooks/use-sessions";

export default function HomePage() {
  const [status, setStatus] = useState("");
  const [pendingDeleteSessionId, setPendingDeleteSessionId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
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
  } = useSessions({ setStatus });

  const { input, busy, canSubmit, setInput, ask, toolProgress } = useChatStream({
    activeSessionId,
    messages,
    setMessages,
    upsertSessionMessages,
    setActiveSessionId,
    refreshSessions,
    setStatus
  });

  const {
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
  } = useNotionTargets({
    messages,
    setStatus
  });

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const scrollRafRef = useRef<number | null>(null);

  const onViewportScroll = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 120;
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !shouldStickToBottomRef.current) return;

    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
    }

    scrollRafRef.current = requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight;
      scrollRafRef.current = null;
    });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  const handleAskSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    shouldStickToBottomRef.current = true;
    void ask();
  }, [ask]);

  const pendingDeleteSession = pendingDeleteSessionId
    ? sessions.find((item) => item.id === pendingDeleteSessionId) || null
    : null;

  return (
    <main className="chat-layout">
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        creatingSession={creatingSession}
        renamingSessionId={renamingSessionId}
        deletingSessionId={deletingSessionId}
        onCreateSession={startDraftSession}
        onOpenSettings={() => setSettingsOpen(true)}
        onSwitchSession={switchSession}
        onRenameSession={openRenameEditor}
        onDeleteSession={(id) => setPendingDeleteSessionId(id)}
      />

      <section className="chat-main">
        <div className="chat-viewport" ref={viewportRef} onScroll={onViewportScroll}>
          {messages.length === 0 ? <div className="chat-empty">有什么可以帮忙的？</div> : null}
          {messages.map((message) => (
            <ChatMessageItem
              key={message.id}
              message={message}
              saving={savingMessageId === message.id}
              toolProgress={message.role === "assistant" && message.streaming ? toolProgress : []}
              onOpenSaveEditor={openSaveEditor}
            />
          ))}
        </div>

        <ChatComposer
          input={input}
          busy={busy}
          canSubmit={canSubmit}
          status={status}
          onInputChange={setInput}
          onSubmit={handleAskSubmit}
        />
      </section>

      <SaveToNotionModal
        saveDraft={saveDraft}
        saving={savingMessageId === saveDraft?.messageId}
        parentQuery={parentQuery}
        parentLoading={parentLoading}
        parentOptions={parentOptions}
        onClose={cancelSaveEditor}
        onSave={() => void submitSaveDraft()}
        onSearch={() => void loadParentOptions(parentQuery)}
        onTitleChange={updateSaveTitle}
        onParentQueryChange={setParentQuery}
        onSelectedParentChange={updateSelectedParentId}
        getOptionLabel={getOptionLabel}
      />

      <RenameSessionModal
        renameDraft={renameDraft}
        renaming={renamingSessionId === renameDraft?.sessionId}
        onClose={cancelRenameEditor}
        onSave={() => void submitRenameDraft()}
        onTitleChange={updateRenameDraftTitle}
      />

      <ConfirmDialog
        open={!!pendingDeleteSession}
        title="删除会话"
        description={`确定删除这个会话吗？删除后无法恢复。${pendingDeleteSession ? `\n\n${pendingDeleteSession.title}` : ""}`}
        confirmText="删除"
        loading={deletingSessionId === pendingDeleteSessionId}
        danger
        onCancel={() => setPendingDeleteSessionId(null)}
        onConfirm={() => {
          if (!pendingDeleteSessionId) return;
          void removeSession(pendingDeleteSessionId).finally(() => {
            setPendingDeleteSessionId(null);
          });
        }}
      />

      <ModalOverlay open={settingsOpen} onClose={() => setSettingsOpen(false)} className="settings-modal-overlay">
        <div className="settings-modal-card" onClick={(event) => event.stopPropagation()}>
          <SettingsPanel mode="modal" onClose={() => setSettingsOpen(false)} />
        </div>
      </ModalOverlay>
    </main>
  );
}
