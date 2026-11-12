import { describe, expect, it } from "vitest";
import { displayStatus, invoiceTotals } from "@/lib/money";
import { localParseInvoice } from "@/lib/ai-fallback";

describe("invoice totals", () => {
  it("applies discount before tax", () => {
    const t = invoiceTotals({
      items: [{ id: "1", description: "x", quantity: 3, unitPrice: 120 }],
      discount: 60,
      taxRate: 10,
    });
    expect(t).toEqual({ subtotal: 360, discount: 60, tax: 30, total: 330 });
  });
  it("never discounts below zero", () => {
    const t = invoiceTotals({ items: [{ id: "1", description: "x", quantity: 1, unitPrice: 50 }], discount: 80, taxRate: 0 });
    expect(t.total).toBe(0);
  });
});

describe("status", () => {
  it("shows sent invoices past due as overdue", () => {
    expect(displayStatus({ status: "sent", dueDate: "2026-01-01" }, "2026-02-01")).toBe("overdue");
    expect(displayStatus({ status: "paid", dueDate: "2026-01-01" }, "2026-02-01")).toBe("paid");
  });
});

describe("demo AI parser", () => {
  it("extracts hours, rate, client and due days", () => {
    const r = localParseInvoice("3 hours branding consultation at $120/hr for Alex due in 14 days");
    expect(r.clientName).toBe("Alex");
    expect(r.items[0]).toMatchObject({ quantity: 3, unitPrice: 120 });
    expect(r.dueInDays).toBe(14);
  });
});