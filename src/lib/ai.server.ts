import { GatewayError, streamResponse } from "@lovable.dev/ai-gateway";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { z } from "zod";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { isAiOperational } from "./integration-status";
import { consumeRate } from "./operator.server";

/** Best-effort isolate-local caps to limit abuse and cost (not a distributed quota). */
export const AI_LIMITS = { perClientPerMinute: 8, perClientPerHour: 40, globalPerHour: 400 } as const;
function aiRateGate() {
  let ip = "unknown";
  try { ip = getRequestHeader("cf-connecting-ip") ?? getRequestIP() ?? "unknown"; } catch {}
  try {
    consumeRate("ai-global", AI_LIMITS.globalPerHour, 60 * 60_000);
    consumeRate(`ai-min:${ip}`, AI_LIMITS.perClientPerMinute, 60_000);
    consumeRate(`ai-hour:${ip}`, AI_LIMITS.perClientPerHour, 60 * 60_000);
  } catch {
    throw new Error("AI request limit reached. Wait a minute and try again");
  }
}

const MODEL = "openai/gpt-6-astra";
let checkedAt: string | null = null;
let lastFailureAt: string | null = null;

export function aiConfigured() {
  return Boolean(process.env["LOVABLE_API_KEY"]);
}

export function aiHealth() {
  return { configured: aiConfigured(), operational: isAiOperational(checkedAt, lastFailureAt), checkedAt, lastFailureAt };
}

/** Streams a structured-output call through Lovable AI Gateway and returns the parsed object. */
export async function structuredCall<T>(schema: z.ZodType<T>, instructions: string, prompt: string): Promise<T> {
  aiRateGate();
  try {
    const stream = await streamResponse({
      model: MODEL,
      instructions,
      input: prompt,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      text: { format: { type: "json_schema", name: "flowpay_proposal", strict: true, schema: zodToJsonSchema(schema, { target: "openAi", $refStrategy: "none" }) } },
    });
    let output = "";
    let completed = false;
    for await (const event of stream) {
      if (event.type === "response.output_text.delta") output += event.delta;
      if (event.type === "response.refusal.done") throw new Error("AI declined this request. No AI proposal was created.");
      if (event.type === "response.incomplete") throw new Error("AI returned an incomplete proposal. Review a demo proposal or try again manually.");
      if (event.type === "response.completed") completed = true;
    }
    if (!completed || !output) throw new Error("AI returned no complete proposal.");
    const parsed = schema.parse(JSON.parse(output));
    checkedAt = new Date().toISOString();
    return parsed;
  } catch (error) {
    lastFailureAt = new Date().toISOString();
    if (error instanceof GatewayError) {
      console.error("AI gateway failure", { code: error.code, status: error.httpStatus, outcome: error.outcome, ids: error.ids });
      if (error.code === "payment_required") throw new Error("AI credits are exhausted. Add credits in Settings → Plans & credits.");
      if (error.code === "rate_limited") throw new Error("AI is rate limited. Wait before trying again.");
      if (error.code === "permission_denied") throw new Error("AI access is unavailable for this workspace. Ask the workspace owner to review AI access.");
      throw new Error("The AI request could not be confirmed. A labelled demo is available; no automatic retry will run.");
    }
    throw error;
  }
}