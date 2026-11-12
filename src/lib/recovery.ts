import type { ReminderTone } from "./ai-schema";
import { daysBetween, displayStatus, invoiceTotals, todayISO } from "./money";
import type { Activity, Invoice } from "./types";

/**
 * Overdue payment recovery copilot.
 * Transparent, deterministic rules grounded only in the user's own invoice data,
 * user-confirmed contact and user-entered circumstances. No AI, no predictions.
 *
 * INVARIANT: only `reminder_confirmed_external` events (the user explicitly said
 * "I sent this outside FlowPay") or a "contacted elsewhere" circumstance count as
 * client contact. Approved/copied drafts and legacy `reminder_sent` records never do.
 */
export interface Recommendation {
  invoiceId: string;
  score: number;
  action: "remind" | "wait" | "resolve" | "review_send" | "watch";
  tone: ReminderTone | null;
  headline: string;
  reasons: string[];
  /** Where each fact came from, for "Why this?" provenance. */
  provenance: string[];
  daysOverdue: number;
  /** Count of user-confirmed external contacts (not drafts). */
  remindersSent: number;
  lastReminderDaysAgo: number | null;
}

export const REMINDER_COOLDOWN_DAYS = 3;

/** Event types that represent real, user-confirmed contact. */
export const CONFIRMED_CONTACT_TYPES = ["reminder_confirmed_external"] as const;

export function isConfirmedContact(a: Activity) {
  return (CONFIRMED_CONTACT_TYPES as readonly string[]).includes(a.type);
}

/** Local calendar date (YYYY-MM-DD) of an ISO timestamp; null when invalid. Date-only strings pass through. */
export function localDateOf(iso: string | undefined): string | null {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : todayISO(d);
}

/** A self-reported contact time must parse, not be in the future, and be within the last year. */
export function isValidContactTime(value: string, now = Date.now()): boolean {
  if (!value) return false;
  const t = new Date(value).getTime();
  return !Number.isNaN(t) && t <= now + 60_000 && t >= now - 366 * 86400000;
}

export function recommendTone(daysOverdue: number, remindersSent: number): ReminderTone {
  if (remindersSent >= 2 || daysOverdue > 45) return "final";
  if (remindersSent === 1 || daysOverdue > 14) return "firm";
  return "friendly";
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function recommendFor(inv: Invoice, activity: Activity[], today = todayISO()): Recommendation | null {
  const ds = displayStatus(inv, today);
  const total = invoiceTotals(inv).total;
  const confirmed = activity.filter((a) => a.invoiceId === inv.id && isConfirmedContact(a));
  const drafts = activity.filter((a) => a.invoiceId === inv.id && (a.type === "reminder_draft_approved" || a.type === "reminder_sent"));
  const circ = inv.circumstance && inv.circumstance.kind !== "none" ? inv.circumstance : undefined;
  const contactDates = confirmed.map((r) => localDateOf(r.contactAt ?? r.at)).filter((x): x is string => x !== null);
  if (circ?.kind === "contacted_elsewhere") { const cd = localDateOf(circ.date ?? circ.updatedAt); if (cd) contactDates.push(cd); }
  const last = contactDates.sort().at(-1);
  const lastAgo = last ? Math.max(0, daysBetween(last, today)) : null;
  const provenance = [
    inv.channel === "paypal_sandbox" ? "Invoice status: PayPal sandbox (last refreshed status)" : inv.channel === "demo" ? "Invoice status: local demo simulation" : "Invoice status: saved in this browser",
    "Due date and amount: from this invoice",
  ];
  if (confirmed.length) provenance.push("Contact history: self-reported by you, not verified by FlowPay");
  if (circ) provenance.push("Client circumstance: entered by you");
  const base = { invoiceId: inv.id, remindersSent: confirmed.length, lastReminderDaysAgo: lastAgo, provenance };

  if (ds === "overdue") {
    const d = daysBetween(inv.dueDate, today);
    const reasons = [`${plural(d, "day")} past the due date.`];
    reasons.push(
      confirmed.length === 0
        ? "No confirmed contact recorded yet."
        : `${plural(confirmed.length, "confirmed contact")} (self-reported), last ${lastAgo === 0 ? "today" : `${plural(lastAgo ?? 0, "day")} ago`}.`,
    );
    if (drafts.length) reasons.push(`${plural(drafts.length, "draft")} approved or copied — not counted as contact because FlowPay can't confirm delivery.`);
    const lateness = Math.min(d, 90) * 1.2 + Math.log10(Math.max(total, 1)) * 10;

    if (circ?.kind === "disputed") {
      reasons.push(`You marked this invoice as disputed${circ.note ? `: “${circ.note}”` : ""}. Reminders are paused — resolve the disagreement first.`);
      return { ...base, score: Math.round(lateness * 0.6), action: "resolve", tone: null, headline: "Resolve the dispute before any reminder", reasons, daysOverdue: d };
    }
    if (circ?.kind === "promised" && circ.date && circ.date >= today) {
      const until = daysBetween(today, circ.date);
      reasons.push(`Client promised payment by ${circ.date} (entered by you) — ${until === 0 ? "that's today" : `${plural(until, "day")} away`}. Wait until then.`);
      return { ...base, score: Math.round(lateness - 50), action: "wait", tone: null, headline: until === 0 ? "Promised payment due today — check before following up" : "Wait for the promised payment date", reasons, daysOverdue: d };
    }
    if (circ?.kind === "promised" && circ.date && circ.date < today) {
      reasons.push(`The promised date (${circ.date}) has passed — a polite check-in is reasonable.`);
    }
    if (lastAgo !== null && lastAgo < REMINDER_COOLDOWN_DAYS) {
      reasons.push(`You confirmed contact within ${REMINDER_COOLDOWN_DAYS} days — give them time to respond.`);
      return { ...base, score: Math.round(lateness - 40), action: "wait", tone: null, headline: "Wait before following up", reasons, daysOverdue: d };
    }
    const tone = circ?.kind === "promised" ? "friendly" : recommendTone(d, confirmed.length);
    reasons.push(
      circ?.kind === "promised"
        ? "Friendly tone suggested: they committed to paying."
        : tone === "friendly"
          ? "Friendly tone suggested: early and no confirmed prior contact."
          : tone === "firm"
            ? "Firm tone suggested: over 2 weeks late or one confirmed reminder."
            : "Final-notice tone suggested: over 45 days late or two or more confirmed reminders.",
    );
    return { ...base, score: Math.round(lateness), action: "remind", tone, headline: `Draft a ${tone === "final" ? "final notice" : `${tone} reminder`}`, reasons, daysOverdue: d };
  }
  if (ds === "draft") {
    return { ...base, score: 15, action: "review_send", tone: null, headline: "Review and send this draft", reasons: ["Finished work isn't billed until the invoice is sent."], daysOverdue: 0 };
  }
  if (ds === "sent") {
    const until = daysBetween(today, inv.dueDate);
    if (until <= 3) {
      return { ...base, score: 10 - until, action: "watch", tone: null, headline: until === 0 ? "Due today" : `Due in ${plural(until, "day")}`, reasons: ["No action needed yet. A reminder becomes available once it's overdue."], daysOverdue: 0 };
    }
  }
  return null;
}

export function prioritize(invoices: Invoice[], activity: Activity[], today = todayISO()) {
  return invoices
    .map((i) => recommendFor(i, activity, today))
    .filter((r): r is Recommendation => r !== null)
    .sort((a, b) => b.score - a.score);
}