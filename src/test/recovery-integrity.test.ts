import { describe, expect, it } from "vitest";
import { recommendFor } from "@/lib/recovery";
import type { Activity, ActivityType, Invoice } from "@/lib/types";

const inv = (p: Partial<Invoice> = {}): Invoice => ({
  id: "inv1", number: "FP-1", clientId: "c1", items: [{ id: "a", description: "Design", quantity: 2, unitPrice: 100 }],
  taxRate: 0, discount: 0, currency: "USD", issueDate: "2026-01-01", dueDate: "2026-01-31", terms: "NET_30",
  status: "sent", createdAt: "2026-01-01", ...p,
});
const ev = (type: ActivityType, at: string, extra: Partial<Activity> = {}): Activity => ({ id: type + at, at: `${at}T10:00:00Z`, type, message: "", invoiceId: "inv1", ...extra });
const TODAY = "2026-02-10";

describe("P0: approved drafts are never treated as contact", () => {
  it("an approved/copied draft yesterday does not trigger the cooldown", () => {
    const r = recommendFor(inv(), [ev("reminder_draft_approved", "2026-02-09")], TODAY);
    expect(r?.action).toBe("remind");
    expect(r?.remindersSent).toBe(0);
  });
  it("legacy reminder_sent records are ignored as contact", () => {
    const r = recommendFor(inv(), [ev("reminder_sent", "2026-02-09"), ev("reminder_sent", "2026-02-08")], TODAY);
    expect(r?.action).toBe("remind");
    expect(r?.remindersSent).toBe(0);
    expect(r?.tone).toBe("friendly"); // 10 days late, 0 confirmed → friendly; counting 2 legacy records would wrongly give "final"
  });
  it("explicit external confirmation within 3 days triggers wait", () => {
    const r = recommendFor(inv(), [ev("reminder_confirmed_external", "2026-02-10", { contactAt: "2026-02-08T09:00:00Z" })], TODAY);
    expect(r?.action).toBe("wait");
    expect(r?.remindersSent).toBe(1);
  });
  it("uses the user's stated contact time, not the logging time", () => {
    const r = recommendFor(inv(), [ev("reminder_confirmed_external", "2026-02-10", { contactAt: "2026-02-01T09:00:00Z" })], TODAY);
    expect(r?.action).toBe("remind");
    expect(r?.lastReminderDaysAgo).toBe(9);
  });
  it("labels confirmed contact as self-reported in provenance", () => {
    const r = recommendFor(inv(), [ev("reminder_confirmed_external", "2026-02-01")], TODAY);
    expect(r?.provenance.some((p) => p.includes("self-reported"))).toBe(true);
  });
});

describe("client circumstances", () => {
  it("disputed invoices get 'resolve', never a reminder tone", () => {
    const r = recommendFor(inv({ dueDate: "2025-12-01", circumstance: { kind: "disputed", updatedAt: "2026-02-01T00:00:00Z" } }), [], TODAY);
    expect(r?.action).toBe("resolve");
    expect(r?.tone).toBeNull();
  });
  it("a future promised date means wait", () => {
    const r = recommendFor(inv({ circumstance: { kind: "promised", date: "2026-02-14", updatedAt: "2026-02-09T00:00:00Z" } }), [], TODAY);
    expect(r?.action).toBe("wait");
  });
  it("after the promised date passes, suggest a friendly reminder", () => {
    const r = recommendFor(inv({ dueDate: "2025-12-01", circumstance: { kind: "promised", date: "2026-02-05", updatedAt: "2026-02-01T00:00:00Z" } }), [], TODAY);
    expect(r?.action).toBe("remind");
    expect(r?.tone).toBe("friendly");
  });
  it("contacted elsewhere 1 day ago honours the 3-day cooldown", () => {
    const r = recommendFor(inv({ circumstance: { kind: "contacted_elsewhere", date: "2026-02-09", updatedAt: "2026-02-09T00:00:00Z" } }), [], TODAY);
    expect(r?.action).toBe("wait");
  });
  it("contacted elsewhere 5 days ago allows a reminder again", () => {
    const r = recommendFor(inv({ circumstance: { kind: "contacted_elsewhere", date: "2026-02-05", updatedAt: "2026-02-05T00:00:00Z" } }), [], TODAY);
    expect(r?.action).toBe("remind");
  });
});