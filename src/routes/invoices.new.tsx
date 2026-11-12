import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Plus, Save, Send, Trash2, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ClientDialog } from "@/components/app/ClientDialog";
import { InvoicePreview } from "@/components/app/InvoicePreview";
import { SendDialog } from "@/components/app/SendDialog";
import { PageHeader, Panel } from "@/components/app/ui-bits";
import { addDaysISO, formatMoney, invoiceTotals, lineTotal, todayISO } from "@/lib/money";
import { uid, useStore } from "@/lib/store";
import { TERMS_DAYS, TERMS_LABEL, type Invoice, type PaymentTerms } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/invoices/new")({
  validateSearch: z.object({ draft: z.string().optional() }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "New invoice — FlowPay AI" },
      { name: "description", content: "Create, preview and send an invoice step by step." },
      { property: "og:title", content: "New invoice — FlowPay AI" },
      { property: "og:description", content: "Create, preview and send an invoice step by step." },
    ],
  }),
  component: Wizard,
});

const STEPS = ["Client", "Line items", "Terms", "Review"] as const;

function blank(currency: string, tax: number): Invoice {
  const t = todayISO();
  return {
    id: uid(), number: "", clientId: "", items: [{ id: uid(), description: "", quantity: 1, unitPrice: 0 }],
    taxRate: tax, discount: 0, currency, issueDate: t, dueDate: addDaysISO(t, 30), terms: "NET_30",
    status: "draft", createdAt: new Date().toISOString(), source: "manual",
  };
}

function Wizard() {
  const store = useStore();
  const { draft } = Route.useSearch();
  const navigate = useNavigate();
  const [inv, setInv] = useState<Invoice>(() => blank(store.settings.currency, store.settings.defaultTaxRate));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [clientOpen, setClientOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!store.hydrated || loaded.current) return;
    loaded.current = true;
    const existing = draft ? store.invoices.find((i) => i.id === draft) : undefined;
    if (existing && existing.status === "draft") { setInv(existing); if (existing.source === "ai") setStep(3); }
    else if (existing) { navigate({ to: "/invoices/$id", params: { id: existing.id }, replace: true }); }
  }, [store.hydrated, draft, store.invoices, navigate]);

  useEffect(() => { if (loaded.current) headingRef.current?.focus(); }, [step]);

  const set = (p: Partial<Invoice>) => setInv((v) => ({ ...v, ...p }));
  const setItem = (id: string, p: Partial<Invoice["items"][0]>) => set({ items: inv.items.map((i) => (i.id === id ? { ...i, ...p } : i)) });
  const t = invoiceTotals(inv);
  const client = store.clients.find((c) => c.id === inv.clientId);

  function validate(s: number) {
    const e: Record<string, string> = {};
    if (s === 0 && !inv.clientId) e["client"] = "Choose a client or add a new one.";
    if (s === 1) {
      inv.items.forEach((i, idx) => {
        if (!i.description.trim()) e[`desc-${i.id}`] = `Describe item ${idx + 1}.`;
        if (!(i.quantity > 0)) e[`qty-${i.id}`] = "Quantity must be more than 0.";
        if (!(i.unitPrice >= 0)) e[`price-${i.id}`] = "Rate can't be negative.";
      });
      if (inv.taxRate < 0 || inv.taxRate > 100) e["tax"] = "Tax must be between 0 and 100%.";
      if (inv.discount < 0) e["discount"] = "Discount can't be negative.";
    }
    if (s === 2 && inv.dueDate < inv.issueDate) e["due"] = "Due date must be on or after the issue date.";
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) requestAnimationFrame(() => document.getElementById(first)?.focus());
    if (Object.keys(e).length) store.announce(`${Object.keys(e).length} field${Object.keys(e).length > 1 ? "s need" : " needs"} attention.`);
    return Object.keys(e).length === 0;
  }

  function persist(): Invoice {
    const number = inv.number || store.takeInvoiceNumber();
    const exists = store.invoices.some((i) => i.id === inv.id);
    const saved = { ...inv, number };
    store.upsertInvoice(saved);
    store.log(exists ? "invoice_updated" : "invoice_created", `${number} ${exists ? "updated" : "saved as draft"}`, { invoiceId: saved.id });
    setInv(saved);
    return saved;
  }

  function saveDraft() {
    if (!validate(0)) { setStep(0); return; }
    const s = persist();
    toast.success(`Draft ${s.number} saved`);
    store.announce(`Draft ${s.number} saved.`);
  }

  function next() { if (validate(step)) setStep((s) => Math.min(3, s + 1)); }
  const err = (k: string) => errors[k] && <p id={`${k}-err`} className="text-sm font-medium text-destructive">{errors[k]}</p>;

  return (
    <>
      <Link to="/invoices" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline"><ArrowLeft className="size-4" aria-hidden /> Invoices</Link>
      <PageHeader title={inv.number ? `Edit ${inv.number}` : "New invoice"} description="Four quick steps. You'll review everything before anything is sent." />

      <nav aria-label="Invoice steps" className="mb-6">
        <ol className="grid grid-cols-4 gap-2">
          {STEPS.map((s, idx) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => { if (idx <= step || validate(step)) setStep(idx); }}
                aria-current={idx === step ? "step" : undefined}
                className={cn("flex min-h-11 w-full flex-col items-start gap-1 border-t-4 pt-2 text-left text-xs font-semibold sm:text-sm",
                  idx < step ? "border-success text-success" : idx === step ? "border-primary text-navy" : "border-border text-muted-foreground")}
              >
                <span className="flex items-center gap-1">{idx < step && <Check className="size-3.5" aria-hidden />}Step {idx + 1}<span className="sr-only">{idx < step ? " (complete)" : ""}</span></span>
                <span className="block truncate text-[11px] font-medium sm:text-sm">{s}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <h2 ref={headingRef} tabIndex={-1} className="mb-5 text-xl font-bold text-navy outline-none">{STEPS[step]}</h2>

          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="client" id="client-label">Client</Label>
                <Select value={inv.clientId} onValueChange={(v) => set({ clientId: v })}>
                  <SelectTrigger id="client" aria-labelledby="client-label client" className="min-h-11" aria-invalid={!!errors["client"]} aria-describedby={errors["client"] ? "client-err" : undefined}>
                    <SelectValue placeholder="Choose a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {store.clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
                {err("client")}
              </div>
              <Button variant="outline" onClick={() => setClientOpen(true)}><UserPlus aria-hidden /> Add new client</Button>
              <ClientDialog open={clientOpen} onOpenChange={setClientOpen} onCreated={(c) => set({ clientId: c.id })} />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <ul className="space-y-4">
                {inv.items.map((i, idx) => (
                  <li key={i.id} className="rounded-xl border p-4">
                    <fieldset>
                      <legend className="mb-3 text-sm font-semibold">Item {idx + 1}</legend>
                      <div className="grid gap-3 sm:grid-cols-6">
                        <div className="space-y-1.5 sm:col-span-6">
                          <Label htmlFor={`desc-${i.id}`}>Description</Label>
                          <Input id={`desc-${i.id}`} value={i.description} onChange={(e) => setItem(i.id, { description: e.target.value })} className="min-h-11" aria-invalid={!!errors[`desc-${i.id}`]} aria-describedby={errors[`desc-${i.id}`] ? `desc-${i.id}-err` : undefined} />
                          {err(`desc-${i.id}`)}
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor={`qty-${i.id}`}>Quantity</Label>
                          <Input id={`qty-${i.id}`} type="number" inputMode="decimal" min={0} step="0.25" value={i.quantity} onChange={(e) => setItem(i.id, { quantity: Number(e.target.value) })} className="min-h-11" aria-invalid={!!errors[`qty-${i.id}`]} />
                          {err(`qty-${i.id}`)}
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor={`price-${i.id}`}>Rate ({inv.currency})</Label>
                          <Input id={`price-${i.id}`} type="number" inputMode="decimal" min={0} step="0.01" value={i.unitPrice} onChange={(e) => setItem(i.id, { unitPrice: Number(e.target.value) })} className="min-h-11" aria-invalid={!!errors[`price-${i.id}`]} />
                          {err(`price-${i.id}`)}
                        </div>
                        <div className="flex items-end justify-between gap-2 sm:col-span-2">
                          <p className="pb-3 text-sm"><span className="text-muted-foreground">Amount </span><span className="tabular font-semibold">{formatMoney(lineTotal(i), inv.currency)}</span></p>
                          {inv.items.length > 1 && (
                            <Button variant="ghost" size="icon" aria-label={`Remove item ${idx + 1}`} onClick={() => set({ items: inv.items.filter((x) => x.id !== i.id) })}><Trash2 aria-hidden /></Button>
                          )}
                        </div>
                      </div>
                    </fieldset>
                  </li>
                ))}
              </ul>
              <Button variant="outline" onClick={() => set({ items: [...inv.items, { id: uid(), description: "", quantity: 1, unitPrice: 0 }] })}><Plus aria-hidden /> Add line item</Button>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tax">Tax rate (%)</Label>
                  <Input id="tax" type="number" min={0} max={100} step="0.1" value={inv.taxRate} onChange={(e) => set({ taxRate: Number(e.target.value) })} className="min-h-11" aria-invalid={!!errors["tax"]} />
                  {err("tax")}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="discount">Discount ({inv.currency})</Label>
                  <Input id="discount" type="number" min={0} step="0.01" value={inv.discount} onChange={(e) => set({ discount: Number(e.target.value) })} className="min-h-11" aria-invalid={!!errors["discount"]} />
                  {err("discount")}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="issue">Issue date</Label>
                  <Input id="issue" type="date" value={inv.issueDate} onChange={(e) => {
                    const d = TERMS_DAYS[inv.terms];
                    set({ issueDate: e.target.value, ...(d != null ? { dueDate: addDaysISO(e.target.value, d) } : {}) });
                  }} className="min-h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="terms" id="terms-label">Payment terms</Label>
                  <Select value={inv.terms} onValueChange={(v) => {
                    const d = TERMS_DAYS[v as PaymentTerms];
                    set({ terms: v as PaymentTerms, ...(d != null ? { dueDate: addDaysISO(inv.issueDate, d) } : {}) });
                  }}>
                    <SelectTrigger id="terms" aria-labelledby="terms-label terms" className="min-h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(TERMS_LABEL) as PaymentTerms[]).map((k) => <SelectItem key={k} value={k}>{TERMS_LABEL[k]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="due">Due date</Label>
                <Input id="due" type="date" value={inv.dueDate} onChange={(e) => set({ dueDate: e.target.value, terms: "CUSTOM" })} className="min-h-11" aria-invalid={!!errors["due"]} aria-describedby={errors["due"] ? "due-err" : "due-hint"} />
                <p id="due-hint" className="text-xs text-muted-foreground">Changing this sets terms to "Custom date".</p>
                {err("due")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Note to client (optional)</Label>
                <Textarea id="notes" rows={4} value={inv.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-sm">
              <p>Check the preview. You can still go back and edit any step.</p>
              <ul className="space-y-2">
                <li className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Client</span><span className="font-semibold">{client?.name ?? "—"}</span></li>
                <li className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Items</span><span className="font-semibold">{inv.items.length}</span></li>
                <li className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Due</span><span className="font-semibold">{inv.dueDate}</span></li>
                <li className="flex justify-between text-base"><span className="font-semibold">Total</span><span className="tabular font-bold text-navy">{formatMoney(t.total, inv.currency)}</span></li>
              </ul>
              {inv.source === "ai" && <p className="rounded-lg bg-primary-soft p-3 text-primary-hover">Drafted with the AI assistant. Please double-check quantities and rates.</p>}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><ArrowLeft aria-hidden /> Back</Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={saveDraft}><Save aria-hidden /> Save draft</Button>
              {step < 3 ? (
                <Button onClick={next}>Next <ArrowRight aria-hidden /></Button>
              ) : (
                <Button onClick={() => { const bad = [0, 1, 2].find((s) => !validate(s)); if (bad !== undefined) { setStep(bad); return; } persist(); setSendOpen(true); }}><Send aria-hidden /> Review &amp; send</Button>
              )}
            </div>
          </div>
        </Panel>

        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Live preview</h2>
          <div className="lg:sticky lg:top-6">
            <InvoicePreview invoice={{ ...inv, number: inv.number || "Draft" }} client={client} settings={store.settings} />
          </div>
        </div>
      </div>

      {sendOpen && (
        <SendDialog
          invoice={store.invoices.find((i) => i.id === inv.id) ?? inv}
          open={sendOpen}
          onOpenChange={setSendOpen}
          onSent={() => navigate({ to: "/invoices/$id", params: { id: inv.id } })}
        />
      )}
    </>
  );
}