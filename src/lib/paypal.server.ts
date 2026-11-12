// PayPal Invoicing REST API v2 — SANDBOX ONLY. Server-side; credentials never reach the browser.
import { buildDraftPayload, DELIVERED_STATUSES, type DraftInput } from "./paypal-payload";

const BASE = "https://api-m.sandbox.paypal.com";
export type { DraftInput };

export function paypalConfigured() {
  return Boolean(process.env["PAYPAL_CLIENT_ID"] && process.env["PAYPAL_CLIENT_SECRET"]);
}

export class PayPalError extends Error {
  constructor(message: string, public status?: number, public debugId?: string) {
    super(message);
  }
}

function friendly(status: number, name?: string) {
  if (status === 401) return "PayPal rejected the sandbox credentials. Check PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET (sandbox, not live).";
  if (status === 403) return "This sandbox app isn't permitted to use Invoicing. Enable Invoicing for the app in the PayPal developer dashboard.";
  if (status === 404) return "PayPal couldn't find this invoice in the sandbox.";
  if (status === 422 || name === "UNPROCESSABLE_ENTITY") return "PayPal couldn't process this invoice";
  if (status === 429) return "PayPal is rate limiting requests. Wait a minute and try again.";
  if (status >= 500) return "PayPal sandbox is having trouble right now. Try again shortly.";
  return `PayPal returned HTTP ${status}`;
}

async function readError(res: Response): Promise<PayPalError> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {}
  const msg = friendly(res.status, body?.name);
  console.error("PayPal error", res.status, body?.name, body?.debug_id);
  return new PayPalError(msg, res.status, body?.debug_id);
}

// Token cache per isolate (tokens last ~9h; refresh 5 min early).
let cached: { token: string; exp: number } | null = null;

export async function getAccessToken(force = false) {
  const id = process.env["PAYPAL_CLIENT_ID"];
  const secret = process.env["PAYPAL_CLIENT_SECRET"];
  if (!id || !secret) throw new PayPalError("PayPal sandbox credentials are not configured.");
  if (!force && cached && cached.exp > Date.now()) return cached.token;
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw await readError(res);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, exp: Date.now() + Math.max(60, json.expires_in - 300) * 1000 };
  return json.access_token;
}

async function api(path: string, init: RequestInit & { requestId?: string }) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
    },
  });
  if (res.status === 401) cached = null;
  if (!res.ok) throw await readError(res);
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/** Idempotent: PayPal-Request-Id is derived from the local invoice + content version. */
export async function createDraftInvoice(input: DraftInput, version: string) {
  const body = await api("/v2/invoicing/invoices", {
    method: "POST",
    requestId: `flowpay-create-${input.localId}-${version}`.slice(0, 108),
    body: JSON.stringify(buildDraftPayload(input)),
  });
  const id: string | undefined = body?.id ?? (typeof body?.href === "string" ? body.href.split("/").pop() : undefined);
  if (!id) throw new PayPalError("PayPal did not return an invoice ID, so nothing was saved.");
  return { id, status: (body?.status as string) ?? "DRAFT" };
}

/** Never re-sends an invoice PayPal already delivered; always confirms by reading back. */
export async function sendInvoice(id: string) {
  const before = await getInvoice(id);
  if (DELIVERED_STATUSES.includes(before.status)) return { ...before, alreadySent: true };
  if (before.status !== "DRAFT") throw new PayPalError(`PayPal reports status ${before.status}; it can't be sent.`);
  await api(`/v2/invoicing/invoices/${encodeURIComponent(id)}/send`, {
    method: "POST",
    requestId: `flowpay-send-${id}`,
    body: JSON.stringify({ send_to_invoicer: true, send_to_recipient: true }),
  });
  return { ...(await getInvoice(id)), alreadySent: false };
}

export async function getInvoice(id: string) {
  const body = await api(`/v2/invoicing/invoices/${encodeURIComponent(id)}`, { method: "GET" });
  return {
    id: String(body?.id ?? id),
    status: String(body?.status ?? "UNKNOWN"),
    recipientViewUrl: (body?.detail?.metadata?.recipient_view_url as string | undefined) ?? undefined,
    total: (body?.amount?.value as string | undefined) ?? undefined,
    dueAmount: (body?.due_amount?.value as string | undefined) ?? undefined,
  };
}