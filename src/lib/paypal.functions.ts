import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createDraftInvoice, getAccessToken, getInvoice, sendInvoice, paypalConfigured, PayPalError } from "./paypal.server";
import { OperatorError, requireOperator, requireInvoiceProof, issueInvoiceProof, withOperatorLock } from "./operator.server";
import { fingerprint, remoteIdentity } from "./operator-crypto.server";

type Fail = { ok: false; message: string; debugId?: string | undefined };
const fail = (e: unknown): Fail => {
  if (e instanceof OperatorError) return { ok: false, message: e.message };
  if (e instanceof PayPalError) return { ok: false, message: e.message, debugId: e.debugId };
  console.error("PayPal action failed unexpectedly");
  return { ok: false, message: "Couldn't reach PayPal sandbox. Check your connection and try again." };
};
const notConnected: Fail = { ok: false, message: "PayPal sandbox is not connected." };

export const getPaypalStatus = createServerFn({ method: "GET" }).handler(async () => ({
  configured: paypalConfigured(),
  environment: "sandbox" as const,
}));

export const verifyPaypal = createServerFn({ method: "POST" }).handler(async () => {
  try {
    await requireOperator("verify");
    if (!paypalConfigured()) return notConnected;
    await getAccessToken(true);
    return { ok: true as const };
  } catch (e) {
    return fail(e);
  }
});

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => { const d = new Date(`${v}T00:00:00Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v; }, "Invalid calendar date");
const draftSchema = z.object({
  version: z.string().min(1).max(40),
  localId: z.string().min(1).max(40),
  number: z.string().min(1).max(16),
  currency: z.literal("USD"),
  issueDate: date,
  dueDate: date,
  existing: z.object({ id: z.string().regex(/^[A-Z0-9-]{3,64}$/i), proof: z.string().min(1).max(2000) }).strict().optional(),
  notes: z.string().max(4000).optional(),
  taxRate: z.number().min(0).max(100),
  discount: z.number().min(0).max(1_000_000),
  invoicer: z.object({ businessName: z.string().trim().min(1).max(300) }),
  recipient: z.object({ name: z.string().trim().min(1).max(140), email: z.string().email().max(254) }),
  items: z
    .array(z.object({ description: z.string().trim().min(1).max(200), quantity: z.number().positive().max(100_000), unitPrice: z.number().min(0).max(1_000_000) }))
    .min(1)
    .max(100),
}).strict().refine((d) => d.dueDate >= d.issueDate, { message: "Due date is before issue date." });

export const createPaypalDraft = createServerFn({ method: "POST" })
  .inputValidator((d) => draftSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const operator = await requireOperator("create");
      if (!paypalConfigured()) return notConnected;
      return await withOperatorLock(operator.sid, async () => {
        const { version: _version, existing, ...input } = data;
        const contentFingerprint = await fingerprint(input);
        if (existing) {
          const ownership = await requireInvoiceProof(operator, existing.id, existing.proof);
          if (ownership.localId !== input.localId || ownership.fingerprint !== contentFingerprint) throw new OperatorError("This PayPal draft cannot be edited or transferred. Restore its original content or create a separate invoice.");
          const remote = await getInvoice(existing.id);
          return { ok: true as const, ...remote, proof: existing.proof };
        }
        const identity = await remoteIdentity(operator.sid, `${input.localId}:${contentFingerprint}`);
        const draft = await createDraftInvoice({ ...input, ...identity }, contentFingerprint);
        // Identity includes the content hash; changed content cannot adopt an earlier draft.
        return { ok: true as const, ...draft, proof: await issueInvoiceProof(operator, draft.id, input.localId, contentFingerprint) };
      });
    } catch (error) { return fail(error); }
  });

const idSchema = z.object({ id: z.string().regex(/^[A-Z0-9-]{3,64}$/i), proof: z.string().min(1).max(2000) }).strict();

export const sendPaypalInvoice = createServerFn({ method: "POST" })
  .inputValidator((d) => idSchema.extend({ approved: z.literal(true) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const operator = await requireOperator("send");
      await requireInvoiceProof(operator, data.id, data.proof);
      if (!paypalConfigured()) return notConnected;
      return await withOperatorLock(operator.sid, async () => ({ ok: true as const, ...await sendInvoice(data.id) }));
    } catch (error) { return fail(error); }
  });

export const refreshPaypalInvoice = createServerFn({ method: "POST" })
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const operator = await requireOperator();
      await requireInvoiceProof(operator, data.id, data.proof);
      if (!paypalConfigured()) return notConnected;
      return await withOperatorLock(operator.sid, async () => ({ ok: true as const, ...await getInvoice(data.id) }));
    } catch (error) { return fail(error); }
  });