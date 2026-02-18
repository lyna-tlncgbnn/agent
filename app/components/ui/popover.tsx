"use client";

import { type CSSProperties, type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";

type PopoverAlign = "start" | "end";

type PopoverProps = {
  open: boolean;
  anchorElement: HTMLElement | null;
  containerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  align?: PopoverAlign;
  offset?: number;
  minWidth?: number;
};

type Position = {
  top: number;
  left: number;
};

export function Popover({
  open,
  anchorElement,
  containerRef,
  onClose,
  children,
  className,
  align = "start",
  offset = 8,
  minWidth
}: PopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<Position | null>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (anchorElement?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      onClose();
    }

    function closeOnEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEsc);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEsc);
    };
  }, [anchorElement, onClose, open]);

  useEffect(() => {
    if (!open || !anchorElement || !containerRef.current) {
      setPosition(null);
      return;
    }

    function updatePosition() {
      if (!anchorElement || !containerRef.current || !popoverRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const anchorRect = anchorElement.getBoundingClientRect();
      const menuRect = popoverRef.current.getBoundingClientRect();

      const rawLeft = align === "start"
        ? anchorRect.left - containerRect.left
        : anchorRect.right - containerRect.left - menuRect.width;
      const boundedLeft = Math.max(8, Math.min(rawLeft, containerRef.current.clientWidth - menuRect.width - 8));
      const top = anchorRect.bottom - containerRect.top + offset;

      setPosition({ top, left: boundedLeft });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [align, anchorElement, containerRef, offset, open]);

  const style: CSSProperties | undefined = useMemo(() => {
    if (!position) {
      return {
        top: 0,
        left: 0,
        minWidth,
        visibility: "hidden",
        pointerEvents: "none"
      };
    }
    return {
      top: position.top,
      left: position.left,
      minWidth
    };
  }, [minWidth, position]);

  if (!open) return null;

  return (
    <div
      ref={popoverRef}
      className={className}
      style={style}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}
