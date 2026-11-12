import { Info } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "./ui-bits";
import { todayISO } from "@/lib/money";
import { useStore } from "@/lib/store";
import { CIRCUMSTANCE_LABEL, type CircumstanceKind, type Invoice } from "@/lib/types";
import { cn } from "@/lib/utils";

const OPTIONS: { value: CircumstanceKind; effect: string }[] = [
  { value: "none", effect: "Normal recommendations based on lateness and confirmed contact." },
  { value: "promised", effect: "Copilot waits until the promised date, then suggests a friendly check-in." },
  { value: "disputed", effect: "Reminders pause; copilot suggests resolving the disagreement first." },
  { value: "contacted_elsewhere", effect: "Counts as confirmed contact on that date and pauses follow-ups for 3 days." },
];

/** User-entered client circumstances. FlowPay never infers these. */
export function CircumstancePanel({ invoice }: { invoice: Invoice }) {
  const store = useStore();
  const cur = invoice.circumstance;
  const [kind, setKind] = useState<CircumstanceKind>(cur?.kind ?? "none");
  const [date, setDate] = useState(cur?.date ?? "");
  const [note, setNote] = useState(cur?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setKind(cur?.kind ?? "none"); setDate(cur?.date ?? ""); setNote(cur?.note ?? ""); }, [cur?.kind, cur?.date, cur?.note]);

  const needsDate = kind === "promised" || kind === "contacted_elsewhere";
  const today = todayISO();

  function save() {
    if (needsDate && !date) { setError(kind === "promised" ? "Enter the date they promised to pay." : "Enter when you contacted them."); return; }
    if (kind === "contacted_elsewhere" && date > today) { setError("Contact date can't be in the future."); return; }
    setError(null);
    store.patchInvoice(invoice.id, { circumstance: kind === "none" && !note.trim() ? undefined : { kind, date: needsDate ? date : undefined, note: note.trim().slice(0, 300) || undefined, updatedAt: new Date().toISOString() } });
    store.log("circumstance_updated", `Client situation for ${invoice.number} set to “${CIRCUMSTANCE_LABEL[kind]}”${needsDate ? ` (${date})` : ""} — entered by you.`, { invoiceId: invoice.id });
    store.announce(`Client situation saved: ${CIRCUMSTANCE_LABEL[kind]}. Recommendation updated.`);
    toast.success("Client situation saved", { description: "The copilot suggestion has been updated." });
  }

  return (
    <Panel aria-labelledby="circ-h">
      <h2 id="circ-h" className="text-lg font-bold text-navy">Client situation</h2>
      <p className="mt-1 text-sm text-muted-foreground">Optional. Only what you know — FlowPay never guesses this.</p>
      <fieldset className="mt-3">
        <legend className="sr-only">What's happening with this payment?</legend>
        <RadioGroup value={kind} onValueChange={(v) => { setKind(v as CircumstanceKind); setError(null); }} className="space-y-2">
          {OPTIONS.map((o) => (
            <Label key={o.value} htmlFor={`circ-${o.value}`} className={cn("flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal", kind === o.value ? "border-primary bg-primary-soft" : "hover:bg-muted")}>
              <RadioGroupItem id={`circ-${o.value}`} value={o.value} className="mt-0.5" aria-labelledby={`circ-${o.value}-text`} />
              <span id={`circ-${o.value}-text`}><span className="block font-semibold">{CIRCUMSTANCE_LABEL[o.value]}</span><span className="block text-xs text-muted-foreground">{o.effect}</span></span>
            </Label>
          ))}
        </RadioGroup>
      </fieldset>
      {needsDate && (
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="circ-date">{kind === "promised" ? "Promised payment date" : "Date you contacted them"}</Label>
          <Input id="circ-date" type="date" value={date} max={kind === "contacted_elsewhere" ? today : undefined} onChange={(e) => { setDate(e.target.value); setError(null); }} aria-invalid={!!error} aria-describedby={error ? "circ-err" : undefined} />
        </div>
      )}
      <div className="mt-3 space-y-1.5">
        <Label htmlFor="circ-note">Note <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea id="circ-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <p id="circ-err" role="alert" className="mt-2 text-sm font-semibold text-destructive">{error}</p>}
      <Button className="mt-3" variant="outline" onClick={save}>Save situation</Button>
      {cur && <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />Last updated {new Date(cur.updatedAt).toLocaleString()} by you.</p>}
    </Panel>
  );
}