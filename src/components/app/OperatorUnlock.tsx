import { useState, useId } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getOperatorStatus, lockSandboxOperator, unlockSandboxOperator } from "@/lib/operator.functions";

export function OperatorUnlock() {
  const id = useId();
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ["operator-status"], queryFn: () => getOperatorStatus(), staleTime: 0, refetchInterval: 30_000 });
  const unlock = useServerFn(unlockSandboxOperator);
  const lock = useServerFn(lockSandboxOperator);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function refresh() { await queryClient.invalidateQueries({ queryKey: ["operator-status"] }); }
  return <section aria-label="Sandbox operator access" className="mt-4 space-y-3 border-t pt-4">
    <h3 className="flex items-center gap-2 text-sm font-semibold"><LockKeyhole className="size-4" aria-hidden /> Sandbox operator access</h3>
    {status.data?.unlocked ? <>
      <p role="status" className="text-sm text-success">Operator unlocked until {new Date(status.data.expiresAt ?? 0).toLocaleTimeString()}. Sandbox only.</p>
      <Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { await lock(); await refresh(); } catch { setMessage("Couldn't lock this session. Try again."); } finally { setBusy(false); } }}>Lock operator</Button>
    </> : <form className="space-y-2" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setMessage(null);
      try { const result = await unlock({ data: { password } }); setPassword(""); if (!result.ok) setMessage(result.message); await refresh(); }
      catch { setPassword(""); setMessage("Operator unlock failed. No access was granted."); }
      finally { setBusy(false); }
    }}>
      {!status.data?.configured && <p className="text-sm text-muted-foreground">Owner setup required: add FLOWPAY_OPERATOR_PASSWORD in Lovable Project Settings → Secrets. Demo remains available.</p>}
      <Label htmlFor={id}>Operator access code</Label>
      <Input id={id} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={256} aria-describedby={message ? `${id}-message` : undefined} required />
      <Button variant="outline" type="submit" disabled={busy || !password || status.isLoading}>{busy && <Loader2 className="animate-spin" aria-hidden />} Unlock sandbox operator</Button>
    </form>}
    {message && <p id={`${id}-message`} role="alert" className="text-sm text-destructive">{message}</p>}
  </section>;
}