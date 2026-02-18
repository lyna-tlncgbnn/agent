"use client";

import { ModalOverlay } from "@/app/components/ui/modal-overlay";
import type { RenameDraft } from "@/app/chat/types";

type RenameSessionModalProps = {
  renameDraft: RenameDraft | null;
  renaming: boolean;
  onClose: () => void;
  onSave: () => void;
  onTitleChange: (value: string) => void;
};

export function RenameSessionModal({
  renameDraft,
  renaming,
  onClose,
  onSave,
  onTitleChange
}: RenameSessionModalProps) {
  return (
    <ModalOverlay open={!!renameDraft} onClose={onClose}>
      <div className="rename-modal-card" onClick={(event) => event.stopPropagation()}>
        <h3>重命名会话</h3>
        <p>输入一个更容易识别的会话标题。</p>
        <input
          type="text"
          value={renameDraft?.title ?? ""}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="请输入会话标题"
          autoFocus
        />
        <div className="rename-modal-actions">
          <button type="button" onClick={onSave} disabled={renaming}>
            {renaming ? "保存中..." : "保存"}
          </button>
          <button type="button" className="secondary" onClick={onClose} disabled={renaming}>
            取消
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
