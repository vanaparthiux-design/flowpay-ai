import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parsedInvoiceSchema, reminderSchema, sanitizeParsed, type AiResult, type ParsedInvoice, type ReminderDraft } from "./ai-schema";
import { aiConfigured, aiHealth, structuredCall } from "./ai.server";

export const getAiStatus = createServerFn({ method: "GET" }).handler(async () => aiHealth());

export const parseInvoiceText = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ text: z.string().min(3).max(2000), today: z.string(), clients: z.array(z.string()).max(200) }).parse(d),
  )
  .handler(async ({ data }): Promise<AiResult<ParsedInvoice>> => {
    if (!aiConfigured()) return { ok: false, reason: "not_configured", message: "Hosted AI is not configured." };
    try {
      const out = await structuredCall(
        parsedInvoiceSchema,
        `You turn a freelancer's plain-language description of completed work into a structured invoice proposal.
Today is ${data.today}. Known clients: ${data.clients.join(", ") || "none"}.
Rules: Never invent prices or emails — if missing, use 0 / null and say so in assumptions. Match the client to a known client when the name clearly matches.
Split distinct services into separate line items. quantity is hours/units; unitPrice is per unit in USD.
dueInDays: number of days from today until due (convert explicit dates). taxRate: percent only if stated, else null.
List every assumption you made in plain, short sentences.`,
        data.text,
      );
      return { ok: true, source: "ai", data: sanitizeParsed(out) };
    } catch (e) {
      console.error("Invoice parsing failed");
      return { ok: false, reason: "error", message: e instanceof Error && e.message !== "not_configured" ? e.message : "AI request failed." };
    }
  });

export const draftReminderAi = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        tone: z.enum(["friendly", "firm", "final"]),
        clientName: z.string(),
        number: z.string(),
        amount: z.string(),
        dueDate: z.string(),
        daysOverdue: z.number(),
        businessName: z.string(),
        items: z.string().max(500),
        remindersSent: z.number().int().min(0).max(50),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<AiResult<ReminderDraft>> => {
    if (!aiConfigured()) return { ok: false, reason: "not_configured", message: "Hosted AI is not configured." };
    try {
      const out = await structuredCall(
        reminderSchema,
        `Write a short, human payment reminder email. Use ONLY the facts provided; do not invent fees, interest, legal action or payment methods. reminders_sent tells you how many earlier reminders exist from a freelancer to a client. Tone: ${data.tone} (friendly = warm nudge; firm = clear and direct; final = final notice, professional, no threats or legal claims). Under 130 words. Mention the invoice number, amount, due date and that the payment link is in the original invoice email. Sign with the business name. Plain text, no placeholders.`,
        JSON.stringify(data),
      );
      const subject = out.subject.trim().slice(0, 200);
      const body = out.body.trim().slice(0, 3000);
      if (!subject || !body) return { ok: false, reason: "error", message: "AI returned an empty draft." };
      return { ok: true, source: "ai", data: { subject, body } };
    } catch (e) {
      console.error("Reminder generation failed");
      return { ok: false, reason: "error", message: e instanceof Error && e.message !== "not_configured" ? e.message : "AI request failed." };
    }
  });