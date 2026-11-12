import { useRef, useState } from "react";
import { toast } from "sonner";
import { createPaypalDraft, refreshPaypalInvoice, sendPaypalInvoice } from "./paypal.functions";
import { useIntegrations } from "./integrations";
import { invoiceTotals } from "./money";
import { DELIVERED_STATUSES, mapPaypalStatus } from "./paypal-payload";
import { useStore } from "./store";
import type { Invoice } from "./types";

/** Content fingerprint: if the invoice is edited after a PayPal draft exists, a fresh draft is created. */
export function invoiceVersion(inv: Invoice) {
  const s = JSON.stringify([inv.clientId, inv.items.map((i) => [i.description, i.quantity, i.unitPrice]), inv.taxRate, inv.discount, inv.issueDate, inv.dueDate, inv.notes ?? ""]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Sends only after explicit user confirmation. Never claims success unless PayPal confirms. */
export function useSendInvoice() {
  const store = useStore();
  const { sandboxActive, operatorUnlocked, loading } = useIntegrations();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function send(inv: Invoice): Promise<boolean> {
    if (inFlight.current) return false; // double-click / duplicate-send guard
    if (inv.status !== "draft") {
      setError("This invoice has already been sent.");
      return false;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const client = store.clients.find((c) => c.id === inv.clientId);
    try {
      if (loading) throw new Error("Still checking the PayPal connection. Try again in a moment.");
      if (!client) throw new Error("This invoice has no client.");
      if (!sandboxActive) {
        store.patchInvoice(inv.id, { status: "sent", channel: "demo", sentAt: new Date().toISOString() });
        store.log("invoice_sent", `${inv.number} marked sent to ${client.name} — SIMULATED in demo mode (no email, no PayPal call)`, { invoiceId: inv.id });
        store.announce(`Invoice ${inv.number} marked as sent in demo mode.`);
        toast.success(`Demo: ${inv.number} marked as sent`, { description: "Simulated locally. No email or money moved." });
        return true;
      }
      if (!operatorUnlocked) throw new Error("Unlock the sandbox operator before sending. No PayPal action was taken.");
      const version = invoiceVersion(inv);
      let paypalId = inv.paypalInvoiceId;
      let proof = inv.paypalOwnershipProof;
      {
        const t = invoiceTotals(inv);
        const d = await createPaypalDraft({
          data: {
            ...(paypalId ? { existing: { id: paypalId, proof: proof ?? "" } } : {}),
            version,
            localId: inv.id,
            number: inv.number,
            currency: "USD",
            issueDate: inv.issueDate,
            dueDate: inv.dueDate,
            ...(inv.notes ? { notes: inv.notes } : {}),
            taxRate: inv.taxRate,
            discount: t.discount,
            invoicer: { businessName: store.settings.businessName },
            recipient: { name: client.name, email: client.email },
            items: inv.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
          },
        });
        if (!d.ok) throw new Error(`Couldn't create the PayPal sandbox draft. ${d.message}${d.debugId ? ` (debug ID ${d.debugId})` : ""}`);
        if (!d.id || !d.status || !d.proof) throw new Error("PayPal did not confirm an authorized draft.");
        paypalId = d.id;
        proof = d.proof;
        store.patchInvoice(inv.id, { paypalInvoiceId: d.id, paypalOwnershipProof: d.proof, paypalStatus: d.status, paypalVersion: version, channel: "paypal_sandbox" });
        store.log("paypal_draft", `${inv.number} draft created in PayPal sandbox (${d.id})`, { invoiceId: inv.id });
      }
      if (!paypalId || !proof) throw new Error("This invoice has no operator ownership proof.");
      const s = await sendPaypalInvoice({ data: { id: paypalId, proof, approved: true } });
      if (!s.ok) throw new Error(`PayPal did not send the invoice. ${s.message}${s.debugId ? ` (debug ID ${s.debugId})` : ""} It is still a draft — you can retry safely.`);
      if (!s.status) throw new Error("PayPal did not confirm a status.");
      if (!DELIVERED_STATUSES.includes(s.status)) {
        throw new Error(`PayPal reports status "${s.status}", so FlowPay is not marking it as sent. Use "Refresh PayPal status" to re-check.`);
      }
      store.patchInvoice(inv.id, {
        status: mapPaypalStatus(s.status, "sent"),
        channel: "paypal_sandbox",
        paypalStatus: s.status,
        paypalLink: s.recipientViewUrl,
        paypalCheckedAt: new Date().toISOString(),
        sentAt: new Date().toISOString(),
      });
      store.log("invoice_sent", `${inv.number} ${s.alreadySent ? "was already sent — synced from" : "sent via"} PayPal sandbox; confirmed status ${s.status}`, { invoiceId: inv.id });
      store.announce(`Invoice ${inv.number} sent. PayPal sandbox confirmed status ${s.status}.`);
      toast.success(`${inv.number} sent via PayPal sandbox`, { description: `PayPal confirmed: ${s.status}` });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sending failed.";
      setError(msg);
      store.log("paypal_error", `${inv.number}: ${msg}`, { invoiceId: inv.id });
      store.announce(`Sending failed. ${msg}`);
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function refresh(inv: Invoice) {
    if (!inv.paypalInvoiceId || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      if (!inv.paypalOwnershipProof) throw new Error("This invoice has no operator ownership proof.");
      const r = await refreshPaypalInvoice({ data: { id: inv.paypalInvoiceId, proof: inv.paypalOwnershipProof } });
      if (!r.ok) {
        toast.error("Couldn't refresh PayPal status", { description: r.message });
        store.announce(`Couldn't refresh PayPal status. ${r.message}`);
        return;
      }
      if (!r.status) throw new Error("PayPal did not confirm a status.");
      const next = mapPaypalStatus(r.status, inv.status);
      store.patchInvoice(inv.id, {
        status: next,
        paypalStatus: r.status,
        paypalLink: r.recipientViewUrl ?? inv.paypalLink,
        paypalCheckedAt: new Date().toISOString(),
        ...(next === "paid" && inv.status !== "paid" ? { paidAt: new Date().toISOString() } : {}),
      });
      if (r.status !== inv.paypalStatus) store.log(next === "paid" ? "invoice_paid" : "invoice_updated", `${inv.number}: PayPal sandbox status changed to ${r.status}`, { invoiceId: inv.id });
      store.announce(`PayPal status is ${r.status}.`);
      toast.success(`PayPal status: ${r.status}`);
    } catch {
      toast.error("Couldn't refresh PayPal status", { description: "Connection failed. Your invoice status has not changed." });
      store.announce("PayPal refresh failed. Your invoice status has not changed.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return { send, refresh, busy, error, sandboxActive, operatorUnlocked, checking: loading };
}