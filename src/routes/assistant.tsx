import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, BellRing, FlaskConical, Loader2, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReminderDialog } from "@/components/app/ReminderDialog";
import { PageHeader, Panel, StatusBadge } from "@/components/app/ui-bits";
import { parseInvoiceText } from "@/lib/ai.functions";
import { localParseInvoice } from "@/lib/ai-fallback";
import type { ParsedInvoice } from "@/lib/ai-schema";
import { useIntegrations } from "@/lib/integrations";
import { prioritize } from "@/lib/recovery";
import { addDaysISO, formatMoney, invoiceTotals, lineTotal, todayISO } from "@/lib/money";
import { uid, useStore } from "@/lib/store";
import type { Invoice } from "@/lib/types";
import { matchClient } from "@/lib/clients";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "AI Assistant — FlowPay AI" },
      { name: "description", content: "Describe completed work in plain language and get an editable invoice proposal." },
      { property: "og:title", content: "AI Assistant — FlowPay AI" },
      { property: "og:description", content: "Plain-language invoices and smart overdue reminders." },
    ],
  }),
  component: Assistant,
});

const EXAMPLES = [
  "3 hours branding consultation at $120/hr for Alex due in 14 days",
  "Website redesign for Priya Shah: 20 hours design at $95 and 8 hours dev at $110, net 30, 8% tax",
  "Logo package $850 for Diego, due next Friday",
];

function Assistant() {
  const store = useStore();
  const navigate = useNavigate();
  const { aiConfigured, aiLabel } = useIntegrations();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<(ParsedInvoice & { source: "ai" | "demo" }) | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [inputErr, setInputErr] = useState<string | null>(null);
  const [reminderFor, setReminderFor] = useState<Invoice | null>(null);
  const [propErr, setPropErr] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim().length < 5) { setInputErr("Describe the work in a few words, including price and client."); store.announce("Describe the work in a few words, including price and client."); document.getElementById("ai-text")?.focus(); return; }
    setInputErr(null); setLoading(true); setNote(null); setResult(null);
    try {
      const r = await parseInvoiceText({ data: { text, today: todayISO(), clients: store.clients.map((c) => c.name) } });
      if (r.ok) {
        setResult({ ...r.data, source: "ai" });
        store.log("ai_generated", `AI drafted an invoice proposal for "${r.data.clientName || "unknown client"}"`);
        store.announce("AI proposal ready. Review the extracted fields below.");
        return;
      }
      setNote(r.reason === "not_configured" ? "Hosted AI isn't configured, so a local demo parser was used." : `AI unavailable: ${r.message} A local demo parser was used instead.`);
    } catch {
      setNote("AI request failed. A local demo parser was used instead.");
    } finally {
      setLoading(false);
    }
    setResult({ ...localParseInvoice(text), source: "demo" });
    store.announce("Demo proposal ready. Review the extracted fields below.");
  }

  function upd(p: Partial<ParsedInvoice>) { setResult((r) => (r ? { ...r, ...p } : r)); }

  function createDraft() {
    if (!result) return;
    const errs: Record<string, string> = {};
    if (!result.clientName.trim()) errs["p-client"] = "Enter the client's name.";
    if (result.items.some((i) => !(i.quantity > 0))) errs["items"] = "Every item needs a quantity above 0.";
    if (result.items.some((i) => !i.description.trim())) errs["items"] = "Every item needs a description.";
    let client = matchClient(store.clients, result.clientName);
    if (!client) {
      const email = result.clientEmail?.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs["p-email"] = "New client — enter a valid email so the invoice can be delivered.";
    }
    setPropErr(errs);
    if (Object.keys(errs).length) {
      const first = Object.keys(errs)[0];
      if (!first) return;
      document.getElementById(first === "items" ? "pi-d-0" : first)?.focus();
      store.announce(Object.values(errs).join(" "));
      return;
    }
    if (!client) {
      const email = result.clientEmail?.trim();
      if (!email) return;
      client = store.addClient({ name: result.clientName.trim(), email });
    }
    const t = todayISO();
    const days = result.dueInDays ?? 30;
    const inv: Invoice = {
      id: uid(), number: store.takeInvoiceNumber(), clientId: client.id,
      items: result.items.map((i) => ({ id: uid(), description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
      taxRate: result.taxRate ?? store.settings.defaultTaxRate, discount: 0, currency: store.settings.currency,
      issueDate: t, dueDate: addDaysISO(t, days),
      terms: ({ 0: "DUE_ON_RECEIPT", 7: "NET_7", 14: "NET_14", 30: "NET_30", 45: "NET_45" } as const)[days as 0] ?? "CUSTOM",
      notes: result.notes ?? undefined, status: "draft", createdAt: new Date().toISOString(), source: "ai",
    };
    store.upsertInvoice(inv);
    store.log("invoice_created", `${inv.number} drafted from ${result.source === "ai" ? "AI" : "demo parser"} proposal`, { invoiceId: inv.id });
    toast.success(`Draft ${inv.number} created`, { description: "Review it before sending." });
    navigate({ to: "/invoices/new", search: { draft: inv.id } });
  }

  const matched = result ? matchClient(store.clients, result.clientName) : undefined;
  const overdue = prioritize(store.invoices, store.activity).filter((r) => r.action === "remind" || r.action === "wait" || r.action === "resolve").flatMap((r) => { const i = store.invoices.find((x) => x.id === r.invoiceId); return i ? [{ r, i }] : []; });
  const total = result ? result.items.reduce((s, i) => s + lineTotal(i), 0) : 0;

  return (
    <>
      <PageHeader
        title="AI Assistant"
        description="Describe finished work in your own words. FlowPay proposes an invoice — you stay in control of every field."
      />
      <p className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm">
        {aiConfigured ? <Sparkles className="size-4 shrink-0 text-primary" aria-hidden /> : <FlaskConical className="size-4 shrink-0 text-warning" aria-hidden />}{aiLabel}
      </p>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="min-w-0 space-y-6 lg:col-span-3">
          <Panel>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ai-text" className="text-base font-semibold">What did you do, for whom, and for how much?</Label>
                <Textarea id="ai-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} aria-invalid={!!inputErr} aria-describedby={inputErr ? "ai-err" : "ai-hint"} />
                <p id="ai-hint" className="text-sm text-muted-foreground">Include quantity, rate, client and due date if you know them.</p>
                {inputErr && <p id="ai-err" className="text-sm font-medium text-destructive">{inputErr}</p>}
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Try an example</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((ex) => (
                    <Button key={ex} type="button" variant="outline" onClick={() => setText(ex)} className="h-auto min-h-11 whitespace-normal text-left text-sm">{ex}</Button>
                  ))}
                </div>
              </div>
              <Button type="submit" size="lg" disabled={loading} className="w-full whitespace-normal sm:w-auto">
                {loading ? <Loader2 className="animate-spin" aria-hidden /> : <Wand2 aria-hidden />}
                {loading ? "Generating proposal…" : "Generate invoice proposal"}
              </Button>
            </form>
          </Panel>

          {loading && (
            <Panel aria-busy="true"><div className="space-y-3">{[0, 1, 2].map((k) => <div key={k} className="h-10 animate-pulse rounded-lg bg-muted" />)}</div></Panel>
          )}

          {result && !loading && (
            <Panel aria-labelledby="prop-h">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 id="prop-h" className="text-lg font-bold text-navy">Proposed invoice</h2>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${result.source === "ai" ? "bg-primary-soft text-primary-hover" : "bg-warning-soft text-warning"}`}>
                  {result.source === "ai" ? <><Sparkles className="size-3.5" aria-hidden /> AI · {result.confidence} confidence</> : <><FlaskConical className="size-3.5" aria-hidden /> Demo simulation</>}
                </span>
              </div>
              {note && <p className="mb-4 text-sm text-muted-foreground">{note}</p>}

              <div className="mb-5 rounded-xl border border-warning/30 bg-warning-soft p-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-warning"><AlertTriangle className="size-4" aria-hidden /> Assumptions to check</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {result.assumptions.length ? result.assumptions.map((a, k) => <li key={k}>{a}</li>) : <li>No assumptions were needed.</li>}
                </ul>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="p-client">Client name</Label>
                  <Input id="p-client" value={result.clientName} onChange={(e) => upd({ clientName: e.target.value })} aria-invalid={!!propErr["p-client"]} aria-describedby={propErr["p-client"] ? "p-client-err p-client-hint" : "p-client-hint"} />
                  {propErr["p-client"] && <p id="p-client-err" className="text-sm font-medium text-destructive">{propErr["p-client"]}</p>}
                  <p id="p-client-hint" className="text-xs text-muted-foreground">{matched ? `Matches existing client: ${matched.name}` : "New client — will be created."}</p>
                </div>
                {!matched && (
                  <div className="space-y-1.5">
                    <Label htmlFor="p-email">Client email</Label>
                    <Input id="p-email" type="email" autoComplete="email" value={result.clientEmail ?? ""} onChange={(e) => upd({ clientEmail: e.target.value })} aria-invalid={!!propErr["p-email"]} aria-describedby={propErr["p-email"] ? "p-email-err" : undefined} />
                    {propErr["p-email"] && <p id="p-email-err" className="text-sm font-medium text-destructive">{propErr["p-email"]}</p>}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="p-due">Due in (days)</Label>
                  <Input id="p-due" type="number" min={0} value={result.dueInDays ?? 30} onChange={(e) => upd({ dueInDays: Number(e.target.value) })} className="min-h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-tax">Tax (%)</Label>
                  <Input id="p-tax" type="number" min={0} max={100} value={result.taxRate ?? 0} onChange={(e) => upd({ taxRate: Number(e.target.value) })} className="min-h-11" />
                </div>
              </div>

              <h3 className="mb-2 mt-5 text-sm font-semibold">Line items</h3>
              <ul className="space-y-3">
                {result.items.map((it, idx) => (
                  <li key={idx} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_90px_110px_auto] sm:items-end">
                    <div className="space-y-1"><Label htmlFor={`pi-d-${idx}`}>Description</Label><Input id={`pi-d-${idx}`} value={it.description} onChange={(e) => upd({ items: result.items.map((x, j) => (j === idx ? { ...x, description: e.target.value } : x)) })} className="min-h-11" /></div>
                    <div className="space-y-1"><Label htmlFor={`pi-q-${idx}`}>Qty</Label><Input id={`pi-q-${idx}`} type="number" min={0} step="0.25" value={it.quantity} onChange={(e) => upd({ items: result.items.map((x, j) => (j === idx ? { ...x, quantity: Number(e.target.value) } : x)) })} className="min-h-11" /></div>
                    <div className="space-y-1"><Label htmlFor={`pi-p-${idx}`}>Rate</Label><Input id={`pi-p-${idx}`} type="number" min={0} step="0.01" value={it.unitPrice} onChange={(e) => upd({ items: result.items.map((x, j) => (j === idx ? { ...x, unitPrice: Number(e.target.value) } : x)) })} className="min-h-11" /></div>
                    <Button variant="ghost" size="icon" aria-label={`Remove item ${idx + 1}`} disabled={result.items.length === 1} onClick={() => upd({ items: result.items.filter((_, j) => j !== idx) })}><Trash2 aria-hidden /></Button>
                  </li>
                ))}
              </ul>
              {propErr["items"] && <p role="alert" className="mt-2 text-sm font-medium text-destructive">{propErr["items"]}</p>}
              <Button variant="outline" className="mt-3" onClick={() => upd({ items: [...result.items, { description: "", quantity: 1, unitPrice: 0 }] })}><Plus aria-hidden /> Add item</Button>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                <p className="text-sm">Estimated total <span className="tabular ml-1 text-xl font-bold text-navy">{formatMoney(invoiceTotals({ items: result.items.map((i, k) => ({ ...i, id: String(k) })), taxRate: result.taxRate ?? 0, discount: 0 }).total)}</span>
                  <span className="sr-only">, subtotal {formatMoney(total)}</span></p>
                <Button onClick={createDraft}>Create draft &amp; review</Button>
              </div>
            </Panel>
          )}
        </div>

        <Panel aria-labelledby="od-h" className="h-fit min-w-0 lg:col-span-2">
          <h2 id="od-h" className="flex items-center gap-2 text-lg font-bold text-navy"><BellRing className="size-5" aria-hidden /> Overdue follow-ups</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">Ranked by days late, balance and your last contact. The copilot suggests a tone and explains why; AI drafts from the invoice data; you edit and approve. Nothing is sent automatically.</p>
          {overdue.length === 0 ? <p className="rounded-lg bg-success-soft p-3 text-sm text-success">No overdue invoices.</p> : (
            <ul className="divide-y">
              {overdue.map(({ r, i }) => (
                <li key={i.id} className="py-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <p className="min-w-0 truncate font-semibold">{store.clients.find((c) => c.id === i.clientId)?.name} · {i.number}</p>
                    <p className="tabular font-semibold">{formatMoney(invoiceTotals(i).total, i.currency)}</p>
                  </div>
                  <p className={`text-sm font-semibold ${r.action === "wait" ? "text-warning" : "text-destructive"}`}>{r.headline}</p>
                  <p className="text-sm text-muted-foreground">{r.reasons.slice(0, 2).join(" ")}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <StatusBadge status="overdue" />
                    <Button size="sm" variant={r.action === "wait" ? "outline" : "default"} onClick={() => setReminderFor(i)}>Draft reminder<span className="sr-only"> for {i.number}</span></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {reminderFor && <ReminderDialog invoice={reminderFor} open={!!reminderFor} onOpenChange={(o) => !o && setReminderFor(null)} />}
    </>
  );
}