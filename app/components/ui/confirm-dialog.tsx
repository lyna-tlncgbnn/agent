"use client";

import { ModalOverlay } from "@/app/components/ui/modal-overlay";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "确认",
  cancelText = "取消",
  loading = false,
  onConfirm,
  onCancel,
  danger = false
}: ConfirmDialogProps) {
  return (
    <ModalOverlay open={open} onClose={onCancel}>
      <div className="confirm-dialog-card" onClick={(event) => event.stopPropagation()}>
        <h3>{title}</h3>
        <p>{description}</p>
        <div className="confirm-dialog-actions">
          <button
            type="button"
            className={danger ? "danger" : ""}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "处理中..." : confirmText}
          </button>
          <button type="button" className="secondary" onClick={onCancel} disabled={loading}>
            {cancelText}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
