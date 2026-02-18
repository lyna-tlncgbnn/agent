"use client";

import { FormEvent } from "react";
import { ArrowUp } from "lucide-react";

type ChatComposerProps = {
  input: string;
  busy: boolean;
  canSubmit: boolean;
  status: string;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ChatComposer({
  input,
  busy,
  canSubmit,
  status,
  onInputChange,
  onSubmit
}: ChatComposerProps) {
  return (
    <form className="composer docked" onSubmit={onSubmit}>
      <textarea
        value={input}
        onChange={(event) => onInputChange(event.target.value)}
        placeholder="继续追问，或输入新问题..."
      />

      <div className="composer-actions">
        <span className="status-inline">{status}</span>
        <button type="submit" className="send-btn" disabled={!canSubmit} aria-label="发送消息">
          {busy ? "..." : <ArrowUp size={16} strokeWidth={2.75} />}
        </button>
      </div>
    </form>
  );
}
