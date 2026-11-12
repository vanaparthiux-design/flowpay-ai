import { describe, expect, it } from "vitest";
import { recommendFor, recommendTone, prioritize } from "@/lib/recovery";
import { buildDraftPayload, mapPaypalStatus, paypalInvoiceNumber, DELIVERED_STATUSES } from "@/lib/paypal-payload";
import { sanitizeParsed } from "@/lib/ai-schema";
import { matchClient } from "@/lib/clients";
import type { Activity, Invoice } from "@/lib/types";

const inv = (p: Partial<Invoice>): Invoice => ({
  id: "inv1", number: "FP-1", clientId: "c1", items: [{ id: "a", description: "Design", quantity: 2, unitPrice: 100 }],
  taxRate: 0, discount: 0, currency: "USD", issueDate: "2026-01-01", dueDate: "2026-01-31", terms: "NET_30",
  status: "sent", createdAt: "2026-01-01", ...p,
});
const reminder = (at: string, invoiceId = "inv1"): Activity => ({ id: at, at: `${at}T10:00:00Z`, type: "reminder_confirmed_external", message: "", invoiceId });

describe("recovery copilot", () => {
  it("suggests friendly, firm, final by lateness and prior reminders", () => {
    expect(recommendTone(5, 0)).toBe("friendly");
    expect(recommendTone(20, 0)).toBe("firm");
    expect(recommendTone(5, 1)).toBe("firm");
    expect(recommendTone(50, 0)).toBe("final");
    expect(recommendTone(5, 2)).toBe("final");
  });
  it("recommends waiting within 3 days of the last reminder", () => {
    const r = recommendFor(inv({}), [reminder("2026-02-09")], "2026-02-10");
    expect(r?.action).toBe("wait");
    expect(r?.tone).toBeNull();
  });
  it("recommends a reminder again after the cooldown, with reasons", () => {
    const r = recommendFor(inv({}), [reminder("2026-02-05")], "2026-02-10");
    expect(r?.action).toBe("remind");
    expect(r?.tone).toBe("firm");
    expect(r?.reasons.length).toBeGreaterThanOrEqual(3);
  });
  it("ranks more-overdue invoices first and ignores paid ones", () => {
    const list = prioritize(
      [inv({ id: "a", dueDate: "2026-02-05" }), inv({ id: "b", dueDate: "2026-01-01" }), inv({ id: "c", status: "paid" })],
      [], "2026-02-10",
    );
    expect(list.map((r) => r.invoiceId)).toEqual(["b", "a"]);
  });
});

describe("PayPal payload", () => {
  const base = {
    localId: "abc123xyz", number: "FP-1009", currency: "USD", issueDate: "2026-10-28", dueDate: "2026-11-11",
    taxRate: 8, discount: 10, invoicer: { businessName: "Studio" }, recipient: { name: "Alex Morgan", email: "a@b.co" },
    items: [{ description: "Consult", quantity: 3, unitPrice: 120 }],
  };
  it("uses a stable invoice number so retries don't duplicate", () => {
    expect(paypalInvoiceNumber("FP-1009", "abc123xyz")).toBe("FP-1009-ABC123XY");
    expect(buildDraftPayload(base).detail.invoice_number).toBe(buildDraftPayload(base).detail.invoice_number);
  });
  it("formats money as 2-decimal strings with tax and discount", () => {
    const p = buildDraftPayload(base);
    expect(p.items[0]).toMatchObject({ quantity: "3", unit_amount: { currency_code: "USD", value: "120.00" }, tax: { percent: "8" } });
    expect(p.amount?.breakdown.discount.invoice_discount.amount.value).toBe("10.00");
    expect(p.primary_recipients[0]!.billing_info.name).toEqual({ given_name: "Alex", surname: "Morgan" });
  });
  it("omits tax and discount when zero", () => {
    const p = buildDraftPayload({ ...base, taxRate: 0, discount: 0 });
    expect("tax" in p.items[0]!).toBe(false);
    expect("amount" in p).toBe(false);
  });
  it("maps PayPal statuses and keeps current on unknown", () => {
    expect(mapPaypalStatus("MARKED_AS_PAID", "sent")).toBe("paid");
    expect(mapPaypalStatus("UNPAID", "draft")).toBe("sent");
    expect(mapPaypalStatus("CANCELLED", "sent")).toBe("cancelled");
    expect(mapPaypalStatus("SOMETHING_NEW", "sent")).toBe("sent");
    expect(DELIVERED_STATUSES).not.toContain("DRAFT");
  });
});

describe("AI output validation", () => {
  it("clamps bad numbers, drops invalid emails and caps items", () => {
    const out = sanitizeParsed({
      clientName: "  Alex ", clientEmail: "not-an-email",
      items: Array.from({ length: 30 }, () => ({ description: "", quantity: -5, unitPrice: Number.NaN })),
      dueInDays: 9999, taxRate: 300, notes: "", assumptions: [], confidence: "low",
    });
    expect(out.clientName).toBe("Alex");
    expect(out.clientEmail).toBeNull();
    expect(out.items).toHaveLength(20);
    expect(out.items[0]).toEqual({ description: "Services", quantity: 0.01, unitPrice: 0 });
    expect(out.dueInDays).toBe(365);
    expect(out.taxRate).toBe(100);
  });
});

describe("client matching", () => {
  const clients = [
    { id: "1", name: "Alex Morgan", email: "a@x.co", createdAt: "" },
    { id: "2", name: "Alex Chen", email: "b@x.co", createdAt: "" },
    { id: "3", name: "Priya Shah", email: "p@x.co", createdAt: "" },
  ];
  it("matches exact names and unique first names only", () => {
    expect(matchClient(clients, "alex morgan")?.id).toBe("1");
    expect(matchClient(clients, "Priya")?.id).toBe("3");
    expect(matchClient(clients, "Alex")).toBeUndefined();
    expect(matchClient(clients, "Alex Smith")).toBeUndefined();
  });
});