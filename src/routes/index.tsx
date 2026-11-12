import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, FileText, ListChecks, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DemoTag, PageHeader, Panel, StatusBadge } from "@/components/app/ui-bits";
import { prioritize } from "@/lib/recovery";
import { displayStatus, formatDate, formatMoney, invoiceTotals, todayISO } from "@/lib/money";
import { useStore } from "@/lib/store";
import { useIntegrations } from "@/lib/integrations";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Dashboard — FlowPay AI" },
      { name: "description", content: "See what's awaiting payment, what's overdue, and what to do next." },
      { property: "og:title", content: "FlowPay AI — Get paid for finished work" },
      { property: "og:description", content: "AI-assisted invoices and follow-ups for freelancers, with PayPal sandbox invoicing." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { invoices, clients, activity, hydrated, settings } = useStore();
  const { sandboxActive, aiLabel } = useIntegrations();
  const today = todayISO();
  const withMeta = invoices.map((i) => ({ ...i, ds: displayStatus(i, today), total: invoiceTotals(i).total }));
  const sum = (arr: typeof withMeta) => arr.reduce((s, i) => s + i.total, 0);
  const awaiting = withMeta.filter((i) => i.ds === "sent");
  const overdue = withMeta.filter((i) => i.ds === "overdue");
  const paid = withMeta.filter((i) => i.ds === "paid");
  const drafts = withMeta.filter((i) => i.ds === "draft");
  const hasDemo = invoices.some((i) => i.demo);
  const cname = (id: string) => clients.find((c) => c.id === id)?.name ?? "Unknown client";

  const allRecs = prioritize(invoices, activity, today);
  const recs = allRecs.slice(0, 3);
  const byId = new Map(withMeta.map((i) => [i.id, i]));

  const metrics = [
    { label: "Awaiting payment", value: sum(awaiting), count: awaiting.length, icon: Clock, tone: "text-primary bg-primary-soft" },
    { label: "Overdue", value: sum(overdue), count: overdue.length, icon: AlertTriangle, tone: "text-destructive bg-destructive-soft" },
    { label: "Collected", value: sum(paid), count: paid.length, icon: CheckCircle2, tone: "text-success bg-success-soft" },
  ];

  return (
    <>
      <PageHeader
        title={`Good to see you${settings.businessName ? `, ${settings.businessName.split(" ")[0]}` : ""}`}
        description="Your payment recovery copilot: what needs attention, why, and the safe next step."
        actions={
          <>
            <Button asChild variant="outline"><Link to="/invoices/new"><Plus aria-hidden /> New invoice</Link></Button>
            <Button asChild><Link to="/assistant"><Sparkles aria-hidden /> Create with AI</Link></Button>
          </>
        }
      />

      {hasDemo && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <DemoTag>Sample data</DemoTag>
          <span className="min-w-[12rem] flex-1">Figures below include fictional demo invoices for illustration only — not real financial results.</span>
          <Link to="/settings" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">Manage demo data</Link>
        </div>
      )}

      <section aria-labelledby="prio-h" className="mb-8 rounded-2xl border border-primary/20 bg-card p-4 shadow-card sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="prio-h" className="flex items-center gap-2 font-display text-xl font-extrabold text-navy"><ListChecks className="size-5 shrink-0" aria-hidden /> Payments needing attention</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Ranked by transparent rules (days late, balance, confirmed contact, and situations you've entered) — not AI. Reminder wording can be AI-drafted; you approve and send it yourself.</p>
          </div>
          {allRecs.length > 3 && <Link to="/invoices" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">{allRecs.length - 3} more in Invoices</Link>}
        </div>
        {!hydrated ? (
          <div className="grid gap-3 md:grid-cols-3">{[0, 1, 2].map((k) => <Skeleton key={k} className="h-48" />)}</div>
        ) : recs.length === 0 ? (
          <p className="rounded-xl bg-success-soft p-4 text-sm text-success">
            <CheckCircle2 className="mr-1 inline size-4" aria-hidden /> You're all caught up. Nothing needs follow-up right now.
          </p>
        ) : (
          <ol className="grid gap-3 md:grid-cols-3">
            {recs.map((r, idx) => {
              const i = byId.get(r.invoiceId);
              if (!i) return null;
              const primary = r.action === "remind" || r.action === "review_send" || r.action === "resolve";
              return (
                <li key={r.invoiceId} className="flex flex-col rounded-xl border bg-background p-4">
                  <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <span className="tabular">Priority {idx + 1}</span> <StatusBadge status={i.ds} />
                    {i.circumstance && i.circumstance.kind !== "none" && <span className="rounded-full border px-2 py-0.5">{i.circumstance.kind === "disputed" ? "Disputed" : i.circumstance.kind === "promised" ? "Promised" : "Contacted"}</span>}
                  </p>
                  <p className="tabular mt-2 font-display text-2xl font-extrabold text-navy">{formatMoney(i.total, i.currency)}</p>
                  <p className="truncate text-sm font-semibold">{cname(i.clientId)} · {i.number}</p>
                  <p className="text-sm text-muted-foreground">{r.daysOverdue > 0 ? `${r.daysOverdue} days overdue` : i.ds === "draft" ? "Not sent yet" : `Due ${formatDate(i.dueDate)}`}</p>
                  <p className={`mt-2 text-sm font-bold ${r.action === "remind" ? "text-destructive" : "text-navy"}`}>{r.headline}</p>
                  <details className="mt-1 text-sm">
                    <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-md font-semibold text-primary">Why this?<span className="sr-only"> ({i.number})</span></summary>
                    <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
                    <p className="mt-2 text-xs font-semibold text-muted-foreground">Sources</p>
                    <ul className="list-disc pl-5 text-xs text-muted-foreground">{r.provenance.map((x) => <li key={x}>{x}</li>)}</ul>
                  </details>
                  <div className="mt-auto pt-3">
                    <Button asChild size="sm" className="w-full" variant={primary ? "default" : "outline"}>
                      <Link to="/invoices/$id" params={{ id: i.id }} search={r.action === "remind" ? { remind: true } : {}}>
                        {r.action === "remind" ? "Draft reminder" : r.action === "review_send" ? "Review & send" : r.action === "resolve" ? "Review dispute" : "Open invoice"}
                        <span className="sr-only"> for {i.number}</span><ArrowRight aria-hidden />
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby="metrics-h" className="mb-8">
        <h2 id="metrics-h" className="sr-only">Key metrics</h2>
        <ul className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {metrics.map((m) => (
            <li key={m.label}>
              <Panel className="h-full p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-muted-foreground">{m.label}</p>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${m.tone}`} aria-hidden><m.icon className="size-5" /></span>
                </div>
                {hydrated ? (
                  <>
                    <p className="tabular mt-1 font-display text-2xl font-extrabold text-navy sm:mt-3 sm:text-3xl">{formatMoney(m.value, settings.currency)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{m.count} invoice{m.count === 1 ? "" : "s"}</p>
                  </>
                ) : (
                  <><Skeleton className="mt-3 h-9 w-32" /><Skeleton className="mt-2 h-4 w-20" /></>
                )}
              </Panel>
            </li>
          ))}
        </ul>
      </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-hero p-6 text-navy-foreground shadow-card">
            <Sparkles className="size-6" aria-hidden />
            <h2 className="mt-3 text-lg font-bold">Describe the work. Get an invoice.</h2>
            <p className="mt-1 text-sm opacity-90">"3 hours branding consultation at $120/hr for Alex due in 14 days"</p>
            <Button asChild variant="secondary" className="mt-4"><Link to="/assistant">Try the AI assistant</Link></Button>
            <p className="mt-3 text-xs opacity-80">
              {aiLabel} · {sandboxActive ? "PayPal sandbox (test mode)" : "Demo mode — sending simulated"}
            </p>
          </section>

          <Panel aria-labelledby="recent-h">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="recent-h" className="text-lg font-bold text-navy">Recent activity</h2>
              <Link to="/activity" className="inline-flex min-h-11 items-center px-1 text-sm font-semibold text-primary hover:underline">View all</Link>
            </div>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {activity.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span><span className="block">{a.message}</span><span className="text-xs text-muted-foreground">{formatDate(a.at)}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
    </>
  );
}