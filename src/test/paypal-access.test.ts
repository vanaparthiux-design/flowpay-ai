import { beforeEach, describe, expect, it, vi } from "vitest";

const operator = vi.hoisted(() => ({ require: vi.fn(), proof: vi.fn() }));
vi.mock("../lib/operator.server", () => ({ requireOperator: operator.require, requireInvoiceProof: operator.proof, issueInvoiceProof: vi.fn(), withOperatorLock: async (_sid: string, work: () => unknown) => work(), OperatorError: class extends Error {} }));

const paypal = vi.hoisted(() => ({ configured: vi.fn(() => true), create: vi.fn(), send: vi.fn(), read: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let parse = (input: unknown) => input;
    const builder = {
      inputValidator: (validator: (input: unknown) => unknown) => { parse = validator; return builder; },
      handler: (handler: (context: unknown) => Promise<unknown>) => async (input: { data: unknown }) => handler({ data: parse(input.data) }),
    };
    return builder;
  },
}));
vi.mock("../lib/paypal.server", () => ({
  paypalConfigured: paypal.configured,
  createDraftInvoice: paypal.create,
  sendInvoice: paypal.send,
  getInvoice: paypal.read,
  getAccessToken: vi.fn(),
  PayPalError: class extends Error {},
}));

import { createPaypalDraft, sendPaypalInvoice, refreshPaypalInvoice } from "../lib/paypal.functions";

describe("public PayPal invoice entry points fail closed", () => {
  beforeEach(() => { vi.clearAllMocks(); paypal.configured.mockReturnValue(true); operator.require.mockRejectedValue(new Error("Unauthorized")); });
  it("denies invoice creation even when credentials are configured", async () => {
    const result = await createPaypalDraft({ data: {
      version: "v1", localId: "fixture", number: "FP-TEST", currency: "USD", issueDate: "2026-11-12", dueDate: "2026-11-26", taxRate: 0, discount: 0,
      invoicer: { businessName: "Fictional test business" }, recipient: { name: "Fictional tester", email: "tester@example.invalid" },
      items: [{ description: "Sandbox test", quantity: 1, unitPrice: 10 }],
    } });
    expect(result.ok).toBe(false);
    expect(paypal.create).not.toHaveBeenCalled();
  });
  it("denies invoice sending even when credentials are configured", async () => {
    expect((await sendPaypalInvoice({ data: { id: "INV2-TEST", proof: "invalid", approved: true } })).ok).toBe(false);
    expect(paypal.send).not.toHaveBeenCalled();
  });
  it("denies invoice retrieval even when credentials are configured", async () => {
    expect((await refreshPaypalInvoice({ data: { id: "INV2-TEST", proof: "invalid" } })).ok).toBe(false);
    expect(paypal.read).not.toHaveBeenCalled();
  });
  it("denies another session's invoice send", async () => {
    operator.require.mockResolvedValue({ sid: "session-b", expires: Date.now() + 10000 });
    operator.proof.mockRejectedValue(new Error("Wrong session"));
    expect((await sendPaypalInvoice({ data: { id: "INV2-TEST", proof: "session-a-proof", approved: true } })).ok).toBe(false);
    expect(paypal.send).not.toHaveBeenCalled();
  });
  it("denies another session's invoice read", async () => {
    operator.require.mockResolvedValue({ sid: "session-b", expires: Date.now() + 10000 });
    operator.proof.mockRejectedValue(new Error("Wrong session"));
    expect((await refreshPaypalInvoice({ data: { id: "INV2-TEST", proof: "session-a-proof" } })).ok).toBe(false);
    expect(paypal.read).not.toHaveBeenCalled();
  });
  it("rejects missing approval and ID-only access", async () => {
    await expect(sendPaypalInvoice({ data: { id: "INV2-TEST", proof: "test", approved: false as true } })).rejects.toThrow();
    await expect(refreshPaypalInvoice({ data: { id: "INV2-TEST", proof: "" } })).rejects.toThrow();
    expect(paypal.send).not.toHaveBeenCalled(); expect(paypal.read).not.toHaveBeenCalled();
  });
});