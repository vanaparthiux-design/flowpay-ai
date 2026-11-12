import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BellRing, CheckCircle2, ExternalLink, Pencil, RefreshCw, Send, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Lightbulb } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { recommendFor } from "@/lib/recovery";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoicePreview } from "@/components/app/InvoicePreview";
import { ReminderDialog } from "@/components/app/ReminderDialog";
import { CircumstancePanel } from "@/components/app/CircumstancePanel";
import { SendDialog } from "@/components/app/SendDialog";
import { DemoTag, EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/ui-bits";
import { displayStatus, formatDate } from "@/lib/money";
import { useStore } from "@/lib/store";
import { useSendInvoice } from "@/lib/use-send-invoice";

export const Route = createFileRoute("/invoices/$id")({
  validateSearch: z.object({ remind: z.boolean().optional() }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Invoice details — FlowPay AI" },
      { name: "description", content: "Invoice status, PayPal sandbox details, reminders and history." },
      { property: "og:title", content: "Invoice details — FlowPay AI" },
      { property: "og:description", content: "Invoice status, reminders and history." },
    ],
  }),
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { id } = Route.useParams();
  const store = useStore();
  const navigate = useNavigate();
  const { refresh, busy } = useSendInvoice();
  const [sendOpen, setSendOpen] = useState(false);
  const { remind } = Route.useSearch();
  const [remOpen, setRemOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const inv = store.invoices.find((i) => i.id === id);
  useEffect(() => {
    if (remind && inv && store.hydrated) { setRemOpen(true); navigate({ to: "/invoices/$id", params: { id }, search: {}, replace: true }); }
  }, [remind, inv, store.hydrated, id, navigate]);

  if (!store.hydrated) return <div className="space-y-4"><Skeleton className="h-10 w-60" /><Skeleton className="h-96" /></div>;
  if (!inv)
    return <EmptyState icon={<Send />} title="Invoice not found" action={<Button asChild><Link to="/invoices">Back to invoices</Link></Button>}>It may have been deleted.</EmptyState>;

  const client = store.clients.find((c) => c.id === inv.clientId);
  const ds = displayStatus(inv);
  const history = store.activity.filter((a) => a.invoiceId === inv.id);
  const rec = recommendFor(inv, store.activity);

  return (
    <>
      <Link to="/invoices" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline"><ArrowLeft className="size-4" aria-hidden /> Invoices</Link>
      <PageHeader
        title={`Invoice ${inv.number}`}
        description={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={ds} /> {client?.name} {inv.demo && <DemoTag />}</span>}
        actions={
          <>
            {inv.status === "draft" && (
              <>
                <Button variant="outline" asChild><Link to="/invoices/new" search={{ draft: inv.id }}><Pencil aria-hidden /> Edit</Link></Button>
                <Button onClick={() => setSendOpen(true)}><Send aria-hidden /> Review &amp; send</Button>
              </>
            )}
            {(ds === "overdue" || ds === "sent") && <Button variant={ds === "overdue" ? "default" : "outline"} onClick={() => setRemOpen(true)}><BellRing aria-hidden /> Draft reminder</Button>}
            {inv.channel === "paypal_sandbox" && inv.paypalInvoiceId && (
              <Button variant="outline" disabled={busy} onClick={() => refresh(inv)}><RefreshCw className={busy ? "animate-spin" : ""} aria-hidden /> Refresh PayPal status</Button>
            )}
            {inv.channel !== "paypal_sandbox" && (ds === "sent" || ds === "overdue") && (
              <Button variant="outline" onClick={() => {
                store.patchInvoice(inv.id, { status: "paid", paidAt: new Date().toISOString() });
                store.log("invoice_paid", `${inv.number} marked paid manually`, { invoiceId: inv.id });
                store.announce(`${inv.number} marked as paid.`);
                toast.success(`${inv.number} marked as paid`);
              }}><CheckCircle2 aria-hidden /> Mark as paid</Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3"><InvoicePreview invoice={inv} client={client} settings={store.settings} /></div>
        <div className="space-y-6 lg:col-span-2">
          {rec && (
            <Panel aria-labelledby="rec-h" className="border-primary/20">
              <h2 id="rec-h" className="flex items-center gap-2 text-lg font-bold text-navy"><Lightbulb className="size-5 shrink-0" aria-hidden /> Copilot suggestion</h2>
              <p className="mt-1 font-semibold">{rec.headline}</p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">{rec.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              <p className="mt-3 text-xs font-semibold text-muted-foreground">Rules-based suggestion (not AI). Sources:</p>
              <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">{rec.provenance.map((r) => <li key={r}>{r}</li>)}</ul>
            </Panel>
          )}
          {(ds === "overdue" || ds === "sent") && <CircumstancePanel invoice={inv} />}
          <Panel aria-labelledby="delivery-h">
            <h2 id="delivery-h" className="mb-3 text-lg font-bold text-navy">Delivery</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Channel</dt><dd className="font-semibold">{inv.channel === "paypal_sandbox" ? "PayPal sandbox" : inv.channel === "demo" ? "Demo simulation" : "Not sent"}</dd></div>
              {inv.paypalInvoiceId && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">PayPal ID</dt><dd className="break-all font-mono text-xs">{inv.paypalInvoiceId}</dd></div>}
              {inv.paypalStatus && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">PayPal status</dt><dd className="font-semibold">{inv.paypalStatus}</dd></div>}
              {inv.sentAt && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Sent</dt><dd>{formatDate(inv.sentAt)}</dd></div>}
              {inv.paypalCheckedAt && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Last checked</dt><dd>{new Date(inv.paypalCheckedAt).toLocaleString()}</dd></div>}
              {inv.paidAt && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Paid</dt><dd>{formatDate(inv.paidAt)}</dd></div>}
            </dl>
            {inv.paypalLink && (
              <Button asChild variant="link" className="mt-2 px-0">
                <a href={inv.paypalLink} target="_blank" rel="noreferrer">Open sandbox invoice <ExternalLink aria-hidden /><span className="sr-only">(opens in new tab)</span></a>
              </Button>
            )}
            {inv.channel === "demo" && inv.status !== "draft" && <p className="mt-3 rounded-lg bg-warning-soft p-2 text-xs font-medium text-warning">SIMULATED in demo mode — no email was sent, nothing exists in PayPal, and no money moved.</p>}
          </Panel>

          <Panel aria-labelledby="hist-h">
            <h2 id="hist-h" className="mb-3 text-lg font-bold text-navy">History</h2>
            {history.length === 0 ? <p className="text-sm text-muted-foreground">No events yet.</p> : (
              <ol className="space-y-3 border-l-2 pl-4 text-sm">
                {history.map((a) => (
                  <li key={a.id}><p className={a.type === "paypal_error" ? "text-destructive" : ""}>{a.type === "reminder_sent" && <span className="font-semibold">Legacy record (unverified, not counted as contact): </span>}{a.message}</p><p className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</p></li>
                ))}
              </ol>
            )}
          </Panel>

          {inv.status === "draft" && (
            <>
              <Button variant="ghost" className="text-destructive" onClick={() => setDelOpen(true)}><Trash2 aria-hidden /> Delete draft</Button>
              <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete draft {inv.number}?</AlertDialogTitle>
                    <AlertDialogDescription>This removes it from FlowPay. {inv.paypalInvoiceId ? "The unsent PayPal sandbox draft is not deleted in PayPal." : ""}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="min-h-11">Keep draft</AlertDialogCancel>
                    <AlertDialogAction className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
                      store.deleteInvoice(inv.id);
                      store.log("invoice_updated", `Draft ${inv.number} deleted`);
                      toast.success("Draft deleted");
                      navigate({ to: "/invoices" });
                    }}>Delete draft</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      <SendDialog invoice={inv} open={sendOpen} onOpenChange={setSendOpen} />
      {remOpen && <ReminderDialog invoice={inv} open={remOpen} onOpenChange={setRemOpen} />}
    </>
  );
}