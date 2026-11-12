import { z } from "zod";

export const parsedInvoiceSchema = z.object({
  clientName: z.string(),
  clientEmail: z.string().nullable(),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
    }),
  ),
  dueInDays: z.number().nullable(),
  taxRate: z.number().nullable(),
  notes: z.string().nullable(),
  assumptions: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]),
});
export type ParsedInvoice = z.infer<typeof parsedInvoiceSchema>;

export const reminderSchema = z.object({
  subject: z.string(),
  body: z.string(),
});
export type ReminderDraft = z.infer<typeof reminderSchema>;

export type ReminderTone = "friendly" | "firm" | "final";

export type AiResult<T> =
  | { ok: true; source: "ai"; data: T }
  | { ok: false; reason: "not_configured" | "error"; message: string };

const clampNum = (n: unknown, min: number, max: number, fallback: number) => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.min(max, Math.max(min, v));
};

/** Defensive post-validation of model output: bounds, trimming, item limits. */
export function sanitizeParsed(p: ParsedInvoice): ParsedInvoice {
  const email = p.clientEmail?.trim() ?? null;
  const items = p.items
    .slice(0, 20)
    .map((i) => ({
      description: String(i.description ?? "").trim().slice(0, 200) || "Services",
      quantity: Math.round(clampNum(i.quantity, 0.01, 100000, 1) * 100) / 100,
      unitPrice: Math.round(clampNum(i.unitPrice, 0, 1000000, 0) * 100) / 100,
    }));
  const assumptions = p.assumptions.map((a) => String(a).trim().slice(0, 240)).filter(Boolean).slice(0, 8);
  if (!items.length) assumptions.push("No billable items were found — add at least one.");
  return {
    clientName: p.clientName.trim().slice(0, 140),
    clientEmail: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    items: items.length ? items : [{ description: "Services", quantity: 1, unitPrice: 0 }],
    dueInDays: p.dueInDays == null ? null : Math.round(clampNum(p.dueInDays, 0, 365, 30)),
    taxRate: p.taxRate == null ? null : clampNum(p.taxRate, 0, 100, 0),
    notes: p.notes?.trim().slice(0, 1000) || null,
    assumptions,
    confidence: p.confidence,
  };
}