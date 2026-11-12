import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { lockOperator, operatorStatus, unlockOperator } from "./operator.server";

export const getOperatorStatus = createServerFn({ method: "GET" }).handler(async () => operatorStatus());
export const unlockSandboxOperator = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ password: z.string().min(1).max(256) }).strict().parse(input))
  .handler(async ({ data }) => {
    try { await unlockOperator(data.password); return { ok: true as const }; }
    catch (error) { return { ok: false as const, message: error instanceof Error ? error.message : "Operator unlock failed." }; }
  });
export const lockSandboxOperator = createServerFn({ method: "POST" }).handler(async () => {
  await lockOperator(); return { ok: true as const };
});