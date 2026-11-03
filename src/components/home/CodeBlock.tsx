/**
 * Code to paste, in a muted panel: a muted comment line, then the code. On phones long
 * lines wrap; from sm up they stay on one line and the block scrolls on its own if needed,
 * so the page never scrolls sideways.
 */
export default function CodeBlock({ comment, code }: { comment?: string; code: string }) {
  return (
    <pre
      className="overflow-x-auto rounded-lg border border-line bg-muted/40 px-4 py-3.5 font-mono text-xs leading-6 break-all whitespace-pre-wrap sm:text-[13px] sm:break-normal sm:whitespace-pre"
    >
      {comment && <span className="block text-muted-foreground">{comment}</span>}
      <code>{code}</code>
    </pre>
  );
}
