import { describe, expect, it } from "vitest";
import { isValidContactTime, localDateOf, recommendFor } from "@/lib/recovery";
import type { Activity, Invoice } from "@/lib/types";

const inv = { id: "i1", number: "INV-1", clientId: "c", status: "sent", issueDate: "2026-10-01", dueDate: "2026-10-20", items: [{ id: "l", description: "x", quantity: 1, unitPrice: 500 }], taxRate: 0, discount: 0, currency: "USD", notes: "", createdAt: "2026-10-01" } as unknown as Invoice;
const act = (p: Partial<Activity>): Activity => ({ id: Math.random().toString(), at: "2026-11-11T10:00:00.000Z", type: "reminder_confirmed_external", message: "m", invoiceId: "i1", ...p }) as Activity;

describe("audit round regressions", () => {
  it("rejects invalid, future and >1 year old contact times", () => {
    const now = new Date("2026-11-12T12:00:00Z").getTime();
    expect(isValidContactTime("", now)).toBe(false);
    expect(isValidContactTime("not-a-date", now)).toBe(false);
    expect(isValidContactTime("2026-11-13T12:00", now)).toBe(false);
    expect(isValidContactTime("2024-01-01T12:00", now)).toBe(false);
    expect(isValidContactTime("2026-11-11T09:00", now)).toBe(true);
  });
  it("ignores corrupt stored contact dates instead of producing NaN cooldowns", () => {
    expect(localDateOf("garbage")).toBeNull();
    const r = recommendFor(inv, [act({ contactAt: "garbage", at: "garbage" })], "2026-11-12")!;
    expect(r.lastReminderDaysAgo).toBeNull();
    expect(r.action).toBe("remind");
  });
  it("confirmed external contact yesterday triggers 3-day wait", () => {
    const r = recommendFor(inv, [act({ contactAt: "2026-11-11T12:00:00.000Z" })], "2026-11-12")!;
    expect(r.action).toBe("wait");
  });
  it("approved drafts and legacy reminder_sent never trigger the wait", () => {
    const r = recommendFor(inv, [act({ type: "reminder_draft_approved" }), act({ type: "reminder_sent" as Activity["type"] })], "2026-11-12")!;
    expect(r.action).toBe("remind");
    expect(r.remindersSent).toBe(0);
  });
});