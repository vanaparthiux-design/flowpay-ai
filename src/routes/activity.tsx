import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, BellRing, CheckCircle2, FilePlus, History, Send, Sparkles, UserPlus } from "lucide-react";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader, Panel } from "@/components/app/ui-bits";
import { useStore } from "@/lib/store";
import type { ActivityType } from "@/lib/types";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Activity — FlowPay AI" },
      { name: "description", content: "A complete log of invoices, sends, reminders and PayPal events." },
      { property: "og:title", content: "Activity — FlowPay AI" },
      { property: "og:description", content: "A complete log of invoices, sends, reminders and PayPal events." },
    ],
  }),
  component: ActivityPage,
});

const ICON: Record<ActivityType, typeof Send> = {
  invoice_created: FilePlus, invoice_updated: FilePlus, invoice_sent: Send, invoice_paid: CheckCircle2,
  paypal_draft: FilePlus, paypal_error: AlertCircle, reminder_sent: BellRing, reminder_draft_approved: BellRing, reminder_confirmed_external: BellRing, circumstance_updated: FilePlus, client_created: UserPlus, ai_generated: Sparkles,
};
const GROUPS: Record<string, ActivityType[] | null> = {
  all: null,
  invoices: ["invoice_created", "invoice_updated", "invoice_sent", "invoice_paid"],
  paypal: ["paypal_draft", "paypal_error"],
  reminders: ["reminder_sent", "reminder_draft_approved", "reminder_confirmed_external", "circumstance_updated"],
  ai: ["ai_generated"],
};

const PROVENANCE: Partial<Record<ActivityType, string>> = {
  reminder_sent: "Legacy record from an older version — approval of a simulated reminder. Unverified; not counted as client contact.",
  reminder_draft_approved: "Draft only — FlowPay did not send anything.",
  reminder_confirmed_external: "Self-reported by you — not verified by FlowPay.",
  circumstance_updated: "Entered by you.",
};

function ActivityPage() {
  const { activity } = useStore();
  const [f, setF] = useState("all");
  const list = GROUPS[f] ? activity.filter((a) => GROUPS[f]!.includes(a.type)) : activity;
  return (
    <>
      <PageHeader title="Activity" description="Every action, recorded — with where each record came from." />
      <div className="mb-5 max-w-xs space-y-1.5">
        <Label htmlFor="act-filter" id="act-filter-label">Show</Label>
        <Select value={f} onValueChange={setF}>
          <SelectTrigger id="act-filter" aria-labelledby="act-filter-label act-filter" className="min-h-11 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All activity</SelectItem>
            <SelectItem value="invoices">Invoices</SelectItem>
            <SelectItem value="paypal">PayPal sandbox events</SelectItem>
            <SelectItem value="reminders">Reminders</SelectItem>
            <SelectItem value="ai">AI</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {list.length === 0 ? <EmptyState icon={<History />} title="Nothing here yet">Actions you take will appear here.</EmptyState> : (
        <Panel>
          <ol className="divide-y">
            {list.map((a) => {
              const I = ICON[a.type];
              return (
                <li key={a.id} className="flex gap-3 py-3">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full ${a.type === "paypal_error" ? "bg-destructive-soft text-destructive" : "bg-primary-soft text-primary"}`} aria-hidden><I className="size-4" /></span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p>{a.type === "paypal_error" && <span className="font-semibold text-destructive">Error: </span>}{a.message}</p>
                    {PROVENANCE[a.type] && <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{PROVENANCE[a.type]}</p>}
                    <p className="text-xs text-muted-foreground"><time dateTime={a.at}>{new Date(a.at).toLocaleString()}</time>
                      {a.invoiceId && <> · <Link to="/invoices/$id" params={{ id: a.invoiceId }} className="font-semibold text-primary underline underline-offset-2 hover:no-underline">View invoice</Link></>}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>
      )}
    </>
  );
}