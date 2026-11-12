import type { Client } from "./types";
/** Exact full-name match, or a single given name that matches exactly one client. */
export function matchClient(clients: Client[], name: string) {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  const exact = clients.find((c) => c.name.toLowerCase() === n);
  if (exact || n.includes(" ")) return exact;
  const firsts = clients.filter((c) => c.name.toLowerCase().split(" ")[0] === n);
  return firsts.length === 1 ? firsts[0] : undefined;
}