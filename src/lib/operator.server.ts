import { getRequestHeader, getRequestIP, setResponseHeader, useSession } from "@tanstack/react-start/server";
import { OPERATOR_TTL_SECONDS, passwordMatches, signOwnership, verifyOwnership } from "./operator-crypto.server";

type OperatorSession = { sid?: string; expires?: number };
export class OperatorError extends Error {}

// Best-effort isolate caps supplement CSRF and secret access; not a distributed quota.
const buckets = new Map<string, { count: number; reset: number }>();
export function consumeRate(key: string, limit: number, windowMs: number, now = Date.now()) {
  for (const [k, value] of buckets) if (value.reset <= now) buckets.delete(k);
  const current = buckets.get(key);
  if (current && current.count >= limit) throw new OperatorError("Too many attempts. Wait before trying again.");
  if (!current && buckets.size >= 2000) throw new OperatorError("Operator access is busy. Try again later.");
  buckets.set(key, { count: (current?.count ?? 0) + 1, reset: current?.reset ?? now + windowMs });
}
const active = new Set<string>();
export async function withOperatorLock<T>(sid: string, work: () => Promise<T>): Promise<T> {
  if (active.has(sid)) throw new OperatorError("Another sandbox action is in progress. Wait for its result.");
  active.add(sid);
  try { return await work(); } finally { active.delete(sid); }
}

function sessionConfig() {
  const password = process.env["FLOWPAY_SESSION_SECRET"];
  if (!password) throw new OperatorError("Operator access is not configured. Add the operator secrets in Lovable Project Settings → Secrets.");
  setResponseHeader("Cache-Control", "no-store");
  return { password, name: "flowpay-operator", maxAge: OPERATOR_TTL_SECONDS, cookie: { httpOnly: true, secure: true, sameSite: "strict" as const, path: "/" },
    // Never accept a client-supplied session via request headers.
    sessionHeader: false as const,
  };
}
export function operatorConfigured() {
  return Boolean(process.env["FLOWPAY_OPERATOR_PASSWORD"] && process.env["FLOWPAY_SESSION_SECRET"]);
}
export async function operatorStatus() {
  setResponseHeader("Cache-Control", "no-store");
  if (!operatorConfigured()) return { configured: false, unlocked: false, expiresAt: null };
  const session = await useSession<OperatorSession>(sessionConfig());
  const unlocked = Boolean(session.data.sid && (session.data.expires ?? 0) > Date.now());
  return { configured: true, unlocked, expiresAt: unlocked ? session.data.expires ?? null : null };
}
export async function unlockOperator(password: string) {
  consumeRate("unlock-global", 20, 15 * 60_000);
  const ip = getRequestHeader("cf-connecting-ip") ?? getRequestIP() ?? "unknown";
  consumeRate(`unlock:${ip}`, 5, 15 * 60_000);
  const expected = process.env["FLOWPAY_OPERATOR_PASSWORD"];
  if (!expected || !operatorConfigured()) throw new OperatorError("Operator access is not configured. Add FLOWPAY_OPERATOR_PASSWORD in Lovable Project Settings → Secrets.");
  if (expected.length < 16) throw new OperatorError("Owner setup requires an operator access code of at least 16 characters.");
  if (!await passwordMatches(password, expected)) throw new OperatorError("Incorrect operator access code.");
  const session = await useSession<OperatorSession>(sessionConfig());
  // New login rotates identity. Prior invoice proofs cannot be adopted by a new session.
  await session.clear();
  await session.update({ sid: crypto.randomUUID(), expires: Date.now() + OPERATOR_TTL_SECONDS * 1000 });
}
export async function lockOperator() {
  if (process.env["FLOWPAY_SESSION_SECRET"]) await (await useSession<OperatorSession>(sessionConfig())).clear();
}
export async function requireOperator(action: "create" | "send" | "read" | "verify" = "read") {
  if (!operatorConfigured()) throw new OperatorError("Unlock operator access before using PayPal sandbox.");
  const session = await useSession<OperatorSession>(sessionConfig());
  const { sid, expires } = session.data;
  if (!sid || !expires || expires <= Date.now()) throw new OperatorError("Unlock operator access before using PayPal sandbox.");
  consumeRate("actions-global", 100, 60_000);
  consumeRate(`actions:${sid}`, 20, 60_000);
  if (action === "create") { consumeRate("create-global", 30, 60 * 60_000); consumeRate(`create:${sid}`, 10, 60 * 60_000); }
  if (action === "send") { consumeRate("send-global", 60, 60 * 60_000); consumeRate(`send:${sid}`, 20, 60 * 60_000); }
  return { sid, expires };
}
export async function issueInvoiceProof(operator: { sid: string; expires: number }, id: string, localId: string, fingerprint: string) {
  const secret = process.env["FLOWPAY_SESSION_SECRET"];
  if (!secret) throw new OperatorError("Operator access is unavailable.");
  return signOwnership({ v: 1, sid: operator.sid, expires: operator.expires, id, localId, fingerprint }, secret);
}
export async function requireInvoiceProof(operator: { sid: string }, id: string, proof: string) {
  const secret = process.env["FLOWPAY_SESSION_SECRET"];
  if (!secret) throw new OperatorError("Operator access is unavailable.");
  try { return await verifyOwnership(proof, secret, operator.sid, id); }
  catch { throw new OperatorError("This invoice does not belong to the active operator session, or its access proof has expired."); }
}