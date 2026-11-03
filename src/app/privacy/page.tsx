import type { Metadata } from "next";
import { CONTAINER, LINK_FOCUS } from "@/components/home/container";
import { CONTACT_EMAIL } from "@/components/home/content";
import HomeFooter from "@/components/home/HomeFooter";
import HomeNav from "@/components/home/HomeNav";
import { type PrivacyBlock, privacy } from "@/components/home/privacy";

export const metadata: Metadata = { title: `${privacy.title} · Analytics`, description: privacy.description };

function Block({ block }: { block: PrivacyBlock }) {
  switch (block.kind) {
    case "p":
      return <p>{block.text}</p>;
    case "list":
      return (
        <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                {block.head.map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row[0]} className="border-t border-line">
                  {row.map((cell, i) => (
                    <td key={i} className={i === 0 ? "px-3 py-2 font-mono text-[13px] text-foreground" : "px-3 py-2"}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "email":
      return (
        <p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className={`font-medium text-foreground underline-offset-4 hover:underline ${LINK_FOCUS}`}
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      );
  }
}

// Public and static, like the homepage. The words live in src/components/home/privacy.ts.
export default function PrivacyPage() {
  return (
    <div className="flex flex-1 flex-col">
      <HomeNav offPage />
      <main className={`${CONTAINER} flex-1 pt-16 pb-24 sm:pt-24`}>
        <article className="max-w-[640px]">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">{privacy.title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{privacy.updated}</p>
          <p className="mt-8 text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">{privacy.intro}</p>
          {privacy.sections.map((s) => (
            <section key={s.heading} className="mt-12">
              <h2 className="text-xl font-semibold tracking-tight">{s.heading}</h2>
              <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-pretty text-muted-foreground">
                {s.blocks.map((b, i) => (
                  <Block key={i} block={b} />
                ))}
              </div>
            </section>
          ))}
        </article>
      </main>
      <HomeFooter offPage />
    </div>
  );
}
