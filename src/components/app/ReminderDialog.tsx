import { isValidContactTime } from "@/lib/recovery";
import { useReturnFocus } from "@/lib/use-return-focus";
import { CheckCircle2, ClipboardCopy, FlaskConical, Lightbulb, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { draftReminderAi } from "@/lib/ai.functions";
import { localReminder } from "@/lib/ai-fallback";
import type { ReminderTone } from "@/lib/ai-schema";
import { daysBetween, formatDate, formatMoney, invoiceTotals, todayISO } from "@/lib/money";
import { recommendFor, recommendTone } from "@/lib/recovery";
import { useStore } from "@/lib/store";
import type { Invoice } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONES: { value: ReminderTone; label: string; hint: string }[] = [
  { value: "friendly", label: "Friendly", hint: "Warm nudge" },
  { value: "firm", label: "Firm", hint: "Clear and direct" },
  { value: "final", label: "Final notice", hint: "Professional, serious" },
];

export function ReminderDialog({ invoice, open, onOpenChange }: { invoice: Invoice; open: boolean; onOpenChange: (o: boolean) => void }) {
  const store = useStore();
  const onCloseAutoFocus = useReturnFocus(open);
  const client = store.clients.find((c) => c.id === invoice.clientId);
  const daysOverdue = Math.max(0, daysBetween(invoice.dueDate, todayISO()));
  const rec = useMemo(() => recommendFor(invoice, store.activity), [invoice, store.activity]);
  const remindersSent = rec?.remindersSent ?? 0;
  const suggested = rec?.tone ?? recommendTone(daysOverdue, remindersSent);
  const [tone, setTone] = useState<ReminderTone>(suggested);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"ai" | "demo" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [extOpen, setExtOpen] = useState(false);
  const [extConfirm, setExtConfirm] = useState(false);
  const [extWhen, setExtWhen] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  const [extChannel, setExtChannel] = useState("email");
  const reqId = useRef(0);

  async function generate(t: ReminderTone) {
    const my = ++reqId.current; // ignore stale responses when tone changes quickly
    setLoading(true);
    setNote(null);
    setApproved(false);
    const ctx = {
      clientName: client?.name ?? "there",
      number: invoice.number,
      amount: formatMoney(invoiceTotals(invoice).total, invoice.currency),
      dueDate: formatDate(invoice.dueDate),
      daysOverdue,
      businessName: store.settings.businessName,
    };
    let draft: { subject: string; body: string } | null = null;
    let src: "ai" | "demo" = "demo";
    let msg: string | null = null;
    try {
      const r = await draftReminderAi({ data: { ...ctx, tone: t, remindersSent, items: invoice.items.map((i) => i.description).join(", ").slice(0, 500) } });
      if (r.ok) { draft = r.data; src = "ai"; }
      else msg = r.reason === "not_configured" ? "Hosted AI isn't available, so this draft uses a demo template (not AI)." : `AI unavailable (${r.message}). Showing a demo template (not AI) instead.`;
    } catch {
      msg = "AI request failed. Showing a demo template (not AI) instead.";
    }
    if (my !== reqId.current) return;
    if (!draft) draft = localReminder(t, ctx);
    setSubject(draft.subject); setBody(draft.body); setSource(src); setNote(msg); setLoading(false);
    store.announce(src === "ai" ? "AI reminder draft ready for review." : "Template reminder ready for review.");
  }

  useEffect(() => {
    if (open) { setTone(suggested); generate(suggested); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const tooSoon = rec?.action === "wait" || rec?.action === "resolve";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Payment reminder for {invoice.number}</DialogTitle>
          <DialogDescription>
            {client?.name} · {daysOverdue > 0 ? `${daysOverdue} days overdue` : "not yet overdue"} · {remindersSent} confirmed contact{remindersSent === 1 ? "" : "s"}. FlowPay does not send reminder emails — you copy the text and send it yourself.
          </DialogDescription>
        </DialogHeader>

        {rec && (
          <section aria-label="Why this recommendation" className={cn("rounded-xl border p-3 text-sm", tooSoon ? "border-warning/40 bg-warning-soft" : "border-primary/20 bg-primary-soft")}>
            <p className="flex items-center gap-2 font-semibold text-navy"><Lightbulb className="size-4 shrink-0" aria-hidden /> {rec.headline}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-6 text-foreground">{rec.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </section>
        )}

        <fieldset disabled={loading}>
          <legend className="mb-2 text-sm font-semibold">Tone <span className="font-normal text-muted-foreground">(suggested: {TONES.find((t) => t.value === suggested)?.label})</span></legend>
          <RadioGroup value={tone} onValueChange={(v) => { setTone(v as ReminderTone); generate(v as ReminderTone); }} className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-3">
            {TONES.map((t) => (
              <Label key={t.value} htmlFor={`tone-${t.value}`} className={cn("flex min-h-14 cursor-pointer items-start gap-2 rounded-lg border p-3 font-normal", tone === t.value ? "border-primary bg-primary-soft ring-1 ring-primary" : "hover:bg-muted")}>
                <RadioGroupItem id={`tone-${t.value}`} value={t.value} className="mt-0.5" aria-labelledby={`tone-${t.value}-text`} />
                <span id={`tone-${t.value}-text`}><span className="block font-semibold">{t.label}</span><span className="block text-xs text-muted-foreground">{t.hint}</span></span>
              </Label>
            ))}
          </RadioGroup>
        </fieldset>

        <div aria-busy={loading} className="space-y-4">
          {source && !loading && (
            <p className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", source === "ai" ? "bg-primary-soft text-primary-hover" : "bg-warning-soft text-warning")}>
              {source === "ai" ? <Sparkles className="size-3.5" aria-hidden /> : <FlaskConical className="size-3.5" aria-hidden />}
              {source === "ai" ? "Drafted by AI from this invoice's data — review before sending" : "Demo template (not AI)"}
            </p>
          )}
          {note && <p className="text-sm text-muted-foreground">{note}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="rem-subject">Subject</Label>
            <Input id="rem-subject" value={subject} onChange={(e) => { setSubject(e.target.value); setApproved(false); }} disabled={loading} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rem-body">Message</Label>
            <Textarea id="rem-body" value={body} onChange={(e) => { setBody(e.target.value); setApproved(false); }} disabled={loading} rows={9} />
          </div>
          {loading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Drafting reminder…</p>}
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
            <Checkbox checked={approved} onCheckedChange={(v) => setApproved(v === true)} className="mt-0.5 size-5" disabled={loading} aria-labelledby="rem-approve-text" />
            <span id="rem-approve-text">I've reviewed this draft and approve its wording.</span>
          </label>
          <p className="text-xs text-muted-foreground">
            Email delivery isn't connected. Approving or copying saves a <strong>draft</strong> record only — it is not counted as contacting {client?.name ?? "the client"} and does not pause recommendations.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => generate(tone)} disabled={loading}><RefreshCw aria-hidden /> Regenerate</Button>
          <Button
            disabled={!approved || loading || !subject.trim() || !body.trim()}
            onClick={async () => {
              let copied = false;
              try { await navigator.clipboard.writeText(`${subject}\n\n${body}`); copied = true; } catch {}
              store.log("reminder_draft_approved", `${TONES.find((t) => t.value === tone)?.label} reminder draft for ${invoice.number} approved${copied ? " and copied" : ""} (${source === "ai" ? "AI draft" : "demo template"}). Not sent by FlowPay.`, { invoiceId: invoice.id });
              store.announce(copied ? "Draft approved and copied. Not sent." : "Draft approved. Copy failed — select the text to copy it.");
              if (copied) toast.success("Draft approved and copied", { description: "Not sent. Paste it into your own email, then confirm below if you send it." });
              else toast.error("Draft approved, but copying failed", { description: "Select the message text to copy it manually." });
              setExtOpen(true);
            }}
          >
            <ClipboardCopy aria-hidden /> Approve &amp; copy draft
          </Button>
        </DialogFooter>

        <section aria-labelledby="ext-h" className="rounded-xl border p-3 text-sm">
          <h3 id="ext-h" className="font-semibold text-navy">Already sent it yourself?</h3>
          {!extOpen ? (
            <Button variant="link" className="min-h-11 px-0" onClick={() => setExtOpen(true)}>Log a reminder I sent outside FlowPay</Button>
          ) : (
            <div className="mt-2 space-y-3">
              <p className="text-muted-foreground">Only log this after you have actually contacted {client?.name ?? "the client"}. It's recorded as <strong>self-reported</strong> (FlowPay can't verify it) and pauses follow-up suggestions for {3} days.</p>
              <div className="grid gap-3 min-[420px]:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ext-when">When did you send it?</Label>
                  <Input id="ext-when" type="datetime-local" value={extWhen} max={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} onChange={(e) => setExtWhen(e.target.value)} aria-invalid={!isValidContactTime(extWhen)} aria-describedby="ext-when-help" />
                  <p id="ext-when-help" className={isValidContactTime(extWhen) ? "text-xs text-muted-foreground" : "text-xs font-medium text-destructive"}>{isValidContactTime(extWhen) ? "Your local time. Must be within the last year, not in the future." : "Enter a valid date and time within the last year, not in the future."}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ext-channel" id="ext-channel-label">How?</Label>
                  <Select value={extChannel} onValueChange={setExtChannel}>
                    <SelectTrigger id="ext-channel" aria-labelledby="ext-channel-label ext-channel"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">My own email</SelectItem>
                      <SelectItem value="phone">Phone call</SelectItem>
                      <SelectItem value="message">Text / chat message</SelectItem>
                      <SelectItem value="in person">In person</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <Checkbox checked={extConfirm} onCheckedChange={(v) => setExtConfirm(v === true)} className="mt-0.5 size-5" aria-labelledby="ext-confirm-text" />
                <span id="ext-confirm-text">I confirm I actually sent a reminder to {client?.name ?? "the client"} outside FlowPay.</span>
              </label>
              <Button
                variant="secondary"
                disabled={!extConfirm || !isValidContactTime(extWhen)}
                onClick={() => {
                  if (!isValidContactTime(extWhen)) return;
                  const at = new Date(extWhen).toISOString();
                  store.log("reminder_confirmed_external", `You confirmed a reminder for ${invoice.number} was sent outside FlowPay by ${extChannel} on ${new Date(at).toLocaleString()} (self-reported, not verified).`, { invoiceId: invoice.id, contactAt: at, contactChannel: extChannel });
                  store.announce("External reminder logged as self-reported contact.");
                  toast.success("Contact logged", { description: "Self-reported. Follow-up suggestions pause for 3 days." });
                  onOpenChange(false);
                }}
              >
                <CheckCircle2 aria-hidden /> Log confirmed contact
              </Button>
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}