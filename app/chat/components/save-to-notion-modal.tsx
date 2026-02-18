"use client";

import { ModalOverlay } from "@/app/components/ui/modal-overlay";
import type { ParentOption, SaveDraft } from "@/app/chat/types";

type SaveToNotionModalProps = {
  saveDraft: SaveDraft | null;
  saving: boolean;
  parentQuery: string;
  parentLoading: boolean;
  parentOptions: ParentOption[];
  onClose: () => void;
  onSave: () => void;
  onSearch: () => void;
  onTitleChange: (value: string) => void;
  onParentQueryChange: (value: string) => void;
  onSelectedParentChange: (value: string) => void;
  getOptionLabel: (item: ParentOption) => string;
};

export function SaveToNotionModal({
  saveDraft,
  saving,
  parentQuery,
  parentLoading,
  parentOptions,
  onClose,
  onSave,
  onSearch,
  onTitleChange,
  onParentQueryChange,
  onSelectedParentChange,
  getOptionLabel
}: SaveToNotionModalProps) {
  return (
    <ModalOverlay open={!!saveDraft} onClose={onClose}>
      <div className="save-modal-card" onClick={(event) => event.stopPropagation()}>
        <h3>保存到 Notion</h3>

        {saveDraft ? (
          <section className="save-panel compact modal">
            <label>
              <span>标题</span>
              <input
                type="text"
                value={saveDraft.title}
                onChange={(event) => onTitleChange(event.target.value)}
              />
            </label>

            <div className="save-panel-search">
              <input
                type="text"
                value={parentQuery}
                onChange={(event) => onParentQueryChange(event.target.value)}
                placeholder="搜索页面标题"
              />
              <button
                type="button"
                className="secondary"
                onClick={onSearch}
                disabled={parentLoading}
              >
                {parentLoading ? "搜索中..." : "搜索"}
              </button>
            </div>

            <label>
              <span>保存到页面</span>
              <select
                value={saveDraft.selectedParentPageId}
                onChange={(event) => onSelectedParentChange(event.target.value)}
                disabled={parentOptions.length === 0}
              >
                <option value="">请选择页面</option>
                {parentOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {getOptionLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            <div className="save-panel-actions">
              <button type="button" onClick={onSave} disabled={saving}>
                {saving ? "保存中..." : "确认保存"}
              </button>
              <button type="button" className="secondary" onClick={onClose} disabled={saving}>
                取消
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </ModalOverlay>
  );
}
