import type { DisplayStatus, Invoice, LineItem } from "./types";

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function lineTotal(item: Pick<LineItem, "quantity" | "unitPrice">) {
  return round2((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));
}

export function invoiceTotals(inv: Pick<Invoice, "items" | "taxRate" | "discount">) {
  const subtotal = round2(inv.items.reduce((s, i) => s + lineTotal(i), 0));
  const discount = round2(Math.min(Math.max(Number(inv.discount) || 0, 0), subtotal));
  const taxable = round2(subtotal - discount);
  const tax = round2((taxable * Math.max(Number(inv.taxRate) || 0, 0)) / 100);
  const total = round2(taxable + tax);
  return { subtotal, discount, tax, total };
}

export function formatMoney(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

export function todayISO(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

export function daysBetween(fromISO: string, toISO: string) {
  const a = new Date(fromISO + "T12:00:00").getTime();
  const b = new Date(toISO + "T12:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

/** Sent invoices whose due date has passed are displayed as overdue. */
export function displayStatus(inv: Pick<Invoice, "status" | "dueDate">, today = todayISO()): DisplayStatus {
  if (inv.status === "sent" && inv.dueDate < today) return "overdue";
  return inv.status;
}

export function formatDate(iso: string) {
  return new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}