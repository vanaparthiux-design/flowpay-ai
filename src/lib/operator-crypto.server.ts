import { z } from "zod";

export const OPERATOR_TTL_SECONDS = 2 * 60 * 60;
export const ownershipSchema = z.object({
  v: z.literal(1), sid: z.string().uuid(), id: z.string().regex(/^[A-Z0-9-]{3,64}$/i),
  localId: z.string().min(1).max(40), fingerprint: z.string().regex(/^[a-f0-9]{64}$/), expires: z.number().int(),
}).strict();
type Ownership = z.infer<typeof ownershipSchema>;
const encoder = new TextEncoder();
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const decode = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function signingKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(`flowpay-ownership-v1:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function fingerprint(value: unknown) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(hash), (n) => n.toString(16).padStart(2, "0")).join("");
}
export async function passwordMatches(input: string, expected: string) {
  const a = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(input)));
  const b = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(expected)));
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
export async function signOwnership(data: Ownership, secret: string) {
  const payload = encode(encoder.encode(JSON.stringify(ownershipSchema.parse(data))));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(payload));
  return `${payload}.${encode(new Uint8Array(signature))}`;
}
export async function verifyOwnership(token: string, secret: string, sid: string, id: string, now = Date.now()) {
  try {
    const parts = token.split(".");
    const payload = parts[0]; const signature = parts[1];
    if (parts.length !== 2 || !payload || !signature || token.length > 2000) throw new Error();
    if (!await crypto.subtle.verify("HMAC", await signingKey(secret), decode(signature), encoder.encode(payload))) throw new Error();
    const data = ownershipSchema.parse(JSON.parse(new TextDecoder().decode(decode(payload))));
    if (data.sid !== sid || data.id !== id || data.expires <= now) throw new Error();
    return data;
  } catch { throw new Error("This invoice does not belong to the active operator session, or its access proof has expired."); }
}

export async function remoteIdentity(sid: string, localId: string) {
  const hash = await fingerprint(["flowpay-sandbox-invoice-v1", sid, localId]);
  return { localId: hash.slice(0, 32), number: `FP-${hash.slice(0, 21).toUpperCase()}` };
}