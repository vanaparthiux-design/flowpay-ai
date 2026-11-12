import { Loader2, Send, ShieldCheck } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate, formatMoney, invoiceTotals } from "@/lib/money";
import { useStore } from "@/lib/store";
import type { Invoice } from "@/lib/types";
import { useSendInvoice } from "@/lib/use-send-invoice";
import { useReturnFocus } from "@/lib/use-return-focus";
import { OperatorUnlock } from "./OperatorUnlock";

export function SendDialog({
  invoice,
  open,
  onOpenChange,
  onSent,
}: {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSent?: () => void;
}) {
  const { clients } = useStore();
  const onCloseAutoFocus = useReturnFocus(open);
  const { send, busy, error, sandboxActive, operatorUnlocked, checking } = useSendInvoice();
  const [confirmed, setConfirmed] = useState(false);
  const client = clients.find((c) => c.id === invoice.clientId);
  const t = invoiceTotals(invoice);

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!busy) { onOpenChange(o); setConfirmed(false); } }}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>Review and send {invoice.number}?</AlertDialogTitle>
          <AlertDialogDescription>
            {sandboxActive
              ? "This creates the invoice in the PayPal sandbox (test environment) and asks PayPal to email it. No real money moves."
              : "Demo mode: PayPal sandbox isn't connected, so sending is simulated in your browser. No email is sent, nothing is created in PayPal, and no money moves."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {sandboxActive && <OperatorUnlock />}
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-muted p-4 text-sm">
          <div><dt className="text-muted-foreground">To</dt><dd className="font-semibold">{client?.name ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Email</dt><dd className="break-all font-semibold">{client?.email ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Total</dt><dd className="tabular text-lg font-bold text-navy">{formatMoney(t.total, invoice.currency)}</dd></div>
          <div><dt className="text-muted-foreground">Due</dt><dd className="font-semibold">{formatDate(invoice.dueDate)}</dd></div>
          <div className="col-span-2"><dt className="text-muted-foreground">Channel</dt><dd className="font-semibold">{sandboxActive ? "PayPal sandbox" : "Demo simulation"}</dd></div>
        </dl>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
          <Checkbox checked={confirmed} disabled={busy} onCheckedChange={(v) => setConfirmed(v === true)} className="mt-0.5 size-5" aria-labelledby="send-approve-text" />
          <span id="send-approve-text">I've reviewed the client, line items and total, and I approve sending this invoice.</span>
        </label>
        {error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} className="min-h-11">Cancel</AlertDialogCancel>
          <Button
            disabled={!confirmed || busy || checking || invoice.status !== "draft" || (sandboxActive && !operatorUnlocked)}
            onClick={async () => {
              const ok = await send(invoice);
              if (ok) { onOpenChange(false); setConfirmed(false); onSent?.(); }
            }}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : sandboxActive ? <ShieldCheck aria-hidden /> : <Send aria-hidden />}
            {busy ? "Sending…" : sandboxActive ? "Send via PayPal sandbox" : "Send (demo)"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}