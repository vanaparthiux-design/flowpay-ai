import { describe, expect, it } from "vitest";
import { isAiOperational } from "../lib/integration-status";

describe("submission integration safety", () => {
  it("does not equate configuration with verified AI", () => {
    expect(isAiOperational(null, null)).toBe(false);
  });
  it("only reports operational after confirmed AI output", () => {
    expect(isAiOperational("2026-11-12T09:30:58Z", null)).toBe(true);
  });
  it("clears operational status after a later failure", () => {
    expect(isAiOperational("2026-11-12T09:30:58Z", "2026-11-12T09:32:00Z")).toBe(false);
  });
});