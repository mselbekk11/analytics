"use client";

import { useEffect, useState } from "react";
import { FiCheck, FiCopy } from "react-icons/fi";

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard blocked (e.g. not a secure context); the text stays selectable
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="flex shrink-0 items-center gap-1.5 rounded border border-line px-2 py-1 text-xs text-muted hover:text-strong"
    >
      {copied ? <FiCheck aria-hidden className="text-up" /> : <FiCopy aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
