import { afterEach, describe, expect, it, vi } from "vitest";
import { fingerprint, passwordMatches, remoteIdentity, signOwnership, verifyOwnership, OPERATOR_TTL_SECONDS } from "../lib/operator-crypto.server";

const fixtureSecret = "TEST_ONLY_NOT_A_DEPLOYED_SECRET_012345678901234567890123456789012345";
const sid = "12345678-1234-4234-8234-123456789012";
const anotherSid = "87654321-4321-4321-8321-210987654321";
const claims = { v: 1 as const, sid, id: "INV2-TEST", localId: "test-local", fingerprint: "a".repeat(64), expires: 2_000_000 };

describe("operator proof cryptography", () => {
  it("accepts only the correct access code", async () => {
    expect(await passwordMatches("test-input", "test-input")).toBe(true);
    expect(await passwordMatches("wrong", "test-input")).toBe(false);
  });
  it("binds proof to session and PayPal invoice", async () => {
    const proof = await signOwnership(claims, fixtureSecret);
    expect((await verifyOwnership(proof, fixtureSecret, sid, "INV2-TEST", 1_000_000)).localId).toBe("test-local");
    await expect(verifyOwnership(proof, fixtureSecret, anotherSid, "INV2-TEST", 1_000_000)).rejects.toThrow();
    await expect(verifyOwnership(proof, fixtureSecret, sid, "INV2-OTHER", 1_000_000)).rejects.toThrow();
  });
  it("rejects expired and tampered proofs", async () => {
    const proof = await signOwnership(claims, fixtureSecret);
    await expect(verifyOwnership(proof, fixtureSecret, sid, "INV2-TEST", claims.expires)).rejects.toThrow();
    await expect(verifyOwnership(`x${proof}`, fixtureSecret, sid, "INV2-TEST", 1_000_000)).rejects.toThrow();
  });
  it("makes stable identities within one session and separates sessions and content", async () => {
    expect(await remoteIdentity(sid, "local:hash-a")).toEqual(await remoteIdentity(sid, "local:hash-a"));
    expect(await remoteIdentity(sid, "local:hash-a")).not.toEqual(await remoteIdentity(anotherSid, "local:hash-a"));
    expect(await fingerprint({ rate: 120 })).not.toBe(await fingerprint({ rate: 121 }));
  });
  it("expires operator access after two hours", () => {
    expect(OPERATOR_TTL_SECONDS).toBe(7200);
  });
});

const runtime = vi.hoisted(() => ({ session: { data: {} as { sid?: string; expires?: number }, clear: vi.fn(), update: vi.fn() }, config: vi.fn() }));
vi.mock("@tanstack/react-start/server", () => ({
  useSession: runtime.config.mockImplementation(async () => runtime.session),
  setResponseHeader: vi.fn(), getRequestHeader: vi.fn(), getRequestIP: vi.fn(),
}));
import { consumeRate, requireOperator, unlockOperator, withOperatorLock } from "../lib/operator.server";

describe("operator server security", () => {
  afterEach(() => { vi.unstubAllEnvs(); runtime.session.data = {}; });
  it("rejects missing and expired cookie identity", async () => {
    vi.stubEnv("FLOWPAY_OPERATOR_PASSWORD", "TEST_ONLY_OPERATOR"); vi.stubEnv("FLOWPAY_SESSION_SECRET", fixtureSecret);
    await expect(requireOperator()).rejects.toThrow("Unlock");
    runtime.session.data = { sid, expires: Date.now() - 1 };
    await expect(requireOperator()).rejects.toThrow("Unlock");
  });
  it("uses a secure HttpOnly Strict cookie, disabling session headers", async () => {
    vi.stubEnv("FLOWPAY_OPERATOR_PASSWORD", "TEST_ONLY_OPERATOR"); vi.stubEnv("FLOWPAY_SESSION_SECRET", fixtureSecret);
    runtime.session.data = { sid, expires: Date.now() + 10000 };
    await requireOperator();
    expect(runtime.config).toHaveBeenLastCalledWith(expect.objectContaining({ maxAge: 7200, sessionHeader: false, cookie: { httpOnly: true, secure: true, sameSite: "strict", path: "/" } }));
  });
  it("validates owner code on the server and rotates identity without storing the code", async () => {
    vi.stubEnv("FLOWPAY_OPERATOR_PASSWORD", "TEST_ONLY_OPERATOR_CODE"); vi.stubEnv("FLOWPAY_SESSION_SECRET", fixtureSecret);
    await expect(unlockOperator("WRONG_TEST_CODE")).rejects.toThrow("Incorrect");
    runtime.session.clear.mockClear(); runtime.session.update.mockClear();
    await unlockOperator("TEST_ONLY_OPERATOR_CODE");
    expect(runtime.session.clear).toHaveBeenCalledOnce();
    expect(runtime.session.update).toHaveBeenCalledWith({ sid: expect.stringMatching(/^[a-f0-9-]{36}$/), expires: expect.any(Number) });
    const stored = runtime.session.update.mock.calls[0]?.[0];
    expect(Object.keys(stored ?? {}).sort()).toEqual(["expires", "sid"]);
  });
  it("caps attempts and releases the rate window", () => {
    consumeRate("unit-window", 2, 1000, 10); consumeRate("unit-window", 2, 1000, 20);
    expect(() => consumeRate("unit-window", 2, 1000, 30)).toThrow("Too many");
    expect(() => consumeRate("unit-window", 2, 1000, 1010)).not.toThrow();
  });
  it("rejects concurrent actions in the same session", async () => {
    let release: (() => void) | undefined;
    const first = withOperatorLock("unit-lock", () => new Promise<void>((resolve) => { release = resolve; }));
    await expect(withOperatorLock("unit-lock", async () => true)).rejects.toThrow("in progress");
    release?.(); await first;
    await expect(withOperatorLock("unit-lock", async () => true)).resolves.toBe(true);
  });
});