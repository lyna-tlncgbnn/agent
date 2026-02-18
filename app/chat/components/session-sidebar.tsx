"use client";

import { memo, useRef, useState } from "react";
import { Ellipsis, MessageSquarePlus, Pencil, Settings, Trash2 } from "lucide-react";
import { Popover } from "@/app/components/ui/popover";
import type { ChatSession } from "@/app/chat/types";

type SessionSidebarProps = {
  sessions: ChatSession[];
  activeSessionId: string | null;
  creatingSession: boolean;
  renamingSessionId: string | null;
  deletingSessionId: string | null;
  onCreateSession: () => void;
  onOpenSettings: () => void;
  onSwitchSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onDeleteSession: (id: string) => void;
};

export const SessionSidebar = memo(function SessionSidebar({
  sessions,
  activeSessionId,
  creatingSession,
  renamingSessionId,
  deletingSessionId,
  onCreateSession,
  onOpenSettings,
  onSwitchSession,
  onRenameSession,
  onDeleteSession
}: SessionSidebarProps) {
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const [menuAnchorElement, setMenuAnchorElement] = useState<HTMLElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);

  const menuSession = menuSessionId ? sessions.find((item) => item.id === menuSessionId) : null;
  const menuBusy = !!menuSessionId && (renamingSessionId === menuSessionId || deletingSessionId === menuSessionId);

  return (
    <aside className="session-sidebar" ref={sidebarRef}>
      <button type="button" className="new-chat-btn" onClick={onCreateSession} disabled={creatingSession}>
        <MessageSquarePlus size={16} />
        <span>{creatingSession ? "创建中..." : "新对话"}</span>
      </button>

      <div className="session-list" role="list">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          const isRenaming = renamingSessionId === session.id;
          const isDeleting = deletingSessionId === session.id;

          return (
            <div key={session.id} className={`session-item ${isActive ? "active" : ""}`} role="listitem">
              <button
                type="button"
                className="session-item-main"
                onClick={() => {
                  setMenuSessionId(null);
                  setMenuAnchorElement(null);
                  onSwitchSession(session.id);
                }}
              >
                <span className="title">{session.title || "新对话"}</span>
              </button>

              <div className="session-item-actions">
                <button
                  type="button"
                  className="session-more-btn"
                  title="会话操作"
                  aria-label="会话操作"
                  aria-expanded={menuSessionId === session.id}
                  onClick={(event) => {
                    event.stopPropagation();

                    if (menuSessionId === session.id) {
                      setMenuSessionId(null);
                      setMenuAnchorElement(null);
                      return;
                    }

                    setMenuSessionId(session.id);
                    setMenuAnchorElement(event.currentTarget);
                  }}
                  disabled={isRenaming || isDeleting}
                >
                  <Ellipsis size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {menuSession ? (
        <Popover
          open={!!menuSessionId}
          anchorElement={menuAnchorElement}
          containerRef={sidebarRef}
          onClose={() => {
            setMenuSessionId(null);
            setMenuAnchorElement(null);
          }}
          className="session-floating-menu"
          align="start"
          minWidth={180}
        >
          <button
            type="button"
            className="session-action-item"
            onClick={() => {
              setMenuSessionId(null);
              setMenuAnchorElement(null);
              onRenameSession(menuSession.id, menuSession.title);
            }}
            disabled={menuBusy}
          >
            <Pencil size={13} />
            <span>重命名</span>
          </button>
          <button
            type="button"
            className="session-action-item danger"
            onClick={() => {
              setMenuSessionId(null);
              setMenuAnchorElement(null);
              onDeleteSession(menuSession.id);
            }}
            disabled={menuBusy}
          >
            <Trash2 size={13} />
            <span>删除</span>
          </button>
        </Popover>
      ) : null}

      <button type="button" className="session-settings-link" onClick={onOpenSettings}>
        <Settings size={16} />
        <span>设置</span>
      </button>
    </aside>
  );
});
