"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

type ModalOverlayProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

export function ModalOverlay({ open, onClose, children, className = "save-modal-overlay" }: ModalOverlayProps) {
  useEffect(() => {
    if (!open) return;

    function closeOnEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", closeOnEsc);
    return () => {
      document.removeEventListener("keydown", closeOnEsc);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <section className={className} onClick={onClose}>
      {children}
    </section>
  );
}
