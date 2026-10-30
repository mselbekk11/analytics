import { Activity, Check, Code, Globe, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type AddStage = "domain" | "install" | "live";

const STEPS: { stage: AddStage; title: string; hint: string; icon: typeof Globe }[] = [
  { stage: "domain", title: "Add your domain", hint: "the timezone comes from your browser", icon: Globe },
  // The minified script is about 2 KB gzipped (src/lib/script.test.ts keeps it under 3 KB)
  { stage: "install", title: "Paste one line", hint: "~2 KB script, loads async", icon: Code },
  { stage: "live", title: "See visitors live", hint: "the dashboard fills in on your first visit", icon: Activity },
];

/** The side panel of /websites/new: the three steps, ticked off as the flow moves on. */
export default function HowItWorks({ stage, received = false }: { stage: AddStage; received?: boolean }) {
  const current = STEPS.findIndex((s) => s.stage === stage);
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>How it works</CardTitle>
        <CardDescription>Live in about two minutes</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ol className="flex flex-col gap-1">
          {STEPS.map((s, i) => {
            const done = i < current || received;
            const active = i === current && !received;
            return (
              <li
                key={s.stage}
                aria-current={active ? "step" : undefined}
                className={`flex items-center gap-3 rounded-lg p-2.5 ${active ? "bg-muted" : ""}`}
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                    done
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : active
                        ? "bg-background text-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check aria-label="Done" className="size-4" /> : <s.icon aria-hidden className="size-4" />}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className={`text-sm ${done || active ? "text-foreground" : "text-muted-foreground"}`}>
                    {s.title}
                  </span>
                  <span className="text-xs text-muted-foreground">{s.hint}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <Alert className="border-transparent bg-muted/60 text-muted-foreground">
          <Lock aria-hidden />
          <AlertDescription>
            No personal data is sold or shared. Add <code className="font-mono text-foreground">data-cookieless</code>{" "}
            to the tag to run without cookies.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
