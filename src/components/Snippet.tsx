"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { embedSnippet } from "@/lib/snippet";

/** The site's one-line embed snippet in a labelled code block with Copy. */
export default function Snippet({ domain }: { domain: string }) {
  const snippet = embedSnippet(domain);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
    } catch {
      // Clipboard blocked (e.g. not a secure context); the text stays selectable
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-muted/40">
      <div className="flex items-center justify-between gap-2 border-b py-1 pr-1 pl-3">
        <span className="text-xs text-muted-foreground">
          HTML · paste in <code className="font-mono">&lt;head&gt;</code>
        </span>
        <Button type="button" variant="ghost" size="xs" onClick={copy}>
          {copied ? <Check aria-hidden className="text-emerald-600 dark:text-emerald-400" /> : <Copy aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="px-3 py-3 font-mono text-xs leading-5 break-all whitespace-pre-wrap">
        <code>{snippet}</code>
      </pre>
    </div>
  );
}
