export type AiHealth = { configured: boolean; operational: boolean; checkedAt: string | null; lastFailureAt: string | null };

export function isAiOperational(checkedAt: string | null, lastFailureAt: string | null) {
  return Boolean(checkedAt && (!lastFailureAt || checkedAt > lastFailureAt));
}

export function aiStatusLabel(health: AiHealth) {
  if (!health.configured) return "Demo simulation — not AI";
  if (health.operational) return "Hosted AI verified operational";
  if (health.lastFailureAt) return "AI request failed — demo available";
  return "AI configured — not yet verified";
}