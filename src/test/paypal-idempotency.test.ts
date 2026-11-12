import { afterEach, expect, it, vi } from "vitest";
import { createDraftInvoice, sendInvoice } from "../lib/paypal.server";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("uses stable create request IDs and does not resend delivered invoices", async () => {
  vi.stubEnv("PAYPAL_CLIENT_ID", "TEST_ONLY_ID"); vi.stubEnv("PAYPAL_CLIENT_SECRET", "TEST_ONLY_SECRET");
  let status = "DRAFT";
  const sends: string[] = []; const creates: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    expect(url.startsWith("https://api-m.sandbox.paypal.com/")).toBe(true);
    if (url.endsWith("/token")) return Response.json({ access_token: "TEST_ONLY_TOKEN", expires_in: 3600 });
    if (url.endsWith("/send")) { sends.push(url); status = "SENT"; return new Response(null, { status: 202 }); }
    if (init.method === "POST") { creates.push(new Headers(init.headers).get("PayPal-Request-Id") ?? ""); return Response.json({ id: "INV2-TEST", status: "DRAFT" }); }
    return Response.json({ id: "INV2-TEST", status });
  }));
  const input = { localId: "test-local", number: "FP-TEST", currency: "USD", issueDate: "2026-11-12", dueDate: "2026-11-26", taxRate: 0, discount: 0,
    invoicer: { businessName: "Test only" }, recipient: { name: "Test only", email: "test@example.invalid" }, items: [{ description: "Test", quantity: 1, unitPrice: 10 }] };
  await createDraftInvoice(input, "a".repeat(64)); await createDraftInvoice(input, "a".repeat(64));
  expect(creates[0]).toBe(creates[1]);
  expect((await sendInvoice("INV2-TEST")).status).toBe("SENT");
  expect((await sendInvoice("INV2-TEST")).alreadySent).toBe(true);
  expect(sends).toHaveLength(1);
});