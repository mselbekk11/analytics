import { persona } from "@/lib/names";

/** The visitor's animal on its colour, stable for the visitor id. */
export default function VisitorAvatar({ visitorId, size = "sm" }: { visitorId: string; size?: "sm" | "lg" }) {
  const p = persona(visitorId);
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full ${
        size === "lg" ? "size-14 text-3xl" : "size-7 text-base"
      }`}
      style={{ backgroundColor: p.color }}
      title={p.name}
      aria-hidden
    >
      {p.emoji}
    </span>
  );
}
