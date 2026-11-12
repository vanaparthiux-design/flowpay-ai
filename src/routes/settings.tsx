import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, FlaskConical, Loader2, PlugZap, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader, Panel } from "@/components/app/ui-bits";
import { useIntegrations } from "@/lib/integrations";
import { verifyPaypal } from "@/lib/paypal.functions";
import { useStore } from "@/lib/store";
import { OperatorUnlock } from "@/components/app/OperatorUnlock";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Settings — FlowPay AI" },
      { name: "description", content: "Business profile, demo mode, PayPal sandbox and AI integration status." },
      { property: "og:title", content: "Settings — FlowPay AI" },
      { property: "og:description", content: "Business profile, demo mode and integration status." },
    ],
  }),
  component: SettingsPage,
});

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
      {ok ? <CheckCircle2 className="size-3.5" aria-hidden /> : <CircleAlert className="size-3.5" aria-hidden />}{label}
    </span>
  );
}

function SettingsPage() {
  const store = useStore();
  const { paypalConfigured, sandboxActive, operatorUnlocked, aiConfigured, aiOperational, aiLabel, aiCheckedAt, loading } = useIntegrations();
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    store.updateSettings({
      businessName: String(f.get("businessName") || "").trim() || "My business",
      businessEmail: String(f.get("businessEmail") || "").trim(),
      defaultTaxRate: Math.min(100, Math.max(0, Number(f.get("tax")) || 0)),
    });
    toast.success("Settings saved");
    store.announce("Settings saved.");
  }

  return (
    <>
      <PageHeader title="Settings" description="Your business details and connection status." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel aria-labelledby="pp-h">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="pp-h" className="flex items-center gap-2 text-lg font-bold text-navy"><PlugZap className="size-5" aria-hidden /> PayPal sandbox</h2>
            {loading ? <Loader2 className="size-4 animate-spin" aria-label="Checking" /> : <Status ok={paypalConfigured} label={paypalConfigured ? "Credentials found" : "Not connected"} />}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            FlowPay uses the PayPal Invoicing REST API v2 in the <strong>sandbox</strong> (test) environment only. Credentials stay on the server. FlowPay AI is an independent project, not affiliated with or endorsed by PayPal.
          </p>
          {paypalConfigured ? (
            <div className="mt-4 space-y-4">
              <label className="flex min-h-11 items-center justify-between gap-4 rounded-xl border p-3">
                <span><span className="block text-sm font-semibold">Send through PayPal sandbox</span><span className="block text-xs text-muted-foreground">Turn off to use demo simulation instead.</span></span>
                <Switch checked={store.settings.useSandbox} onCheckedChange={(v) => store.updateSettings({ useSandbox: v })} />
              </label>
              <Button variant="outline" disabled={verifying || !operatorUnlocked} onClick={async () => {
                setVerifying(true);
                try {
                  const r = await verifyPaypal();
                  setVerifyMsg(r.ok ? { ok: true, text: "PayPal sandbox OAuth verified. Invoice delivery is not yet verified." } : { ok: false, text: r.message });
                  store.announce(r.ok ? "PayPal sandbox OAuth verified. Invoice delivery is not yet verified." : `PayPal verification failed: ${r.message}`);
                } catch {
                  setVerifyMsg({ ok: false, text: "Connection test failed. No authentication was confirmed." });
                  store.announce("PayPal connection test failed.");
                } finally { setVerifying(false); }
              }}>{verifying && <Loader2 className="animate-spin" aria-hidden />} Test connection</Button>
              {verifyMsg && <p role="status" className={`text-sm ${verifyMsg.ok ? "text-success" : "text-destructive"}`}>{verifyMsg.text}</p>}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
              <p className="flex items-center gap-2 font-bold text-warning"><FlaskConical className="size-4" aria-hidden /> Demo mode is on</p>
              <p className="mt-1">Invoices are "sent" locally. No email is sent and no money moves.</p>
              <h3 className="mt-3 font-semibold">Connect PayPal sandbox</h3>
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                <li>Sign in at <a className="font-semibold text-navy underline" href="https://developer.paypal.com/dashboard/applications/sandbox" target="_blank" rel="noreferrer">developer.paypal.com<span className="sr-only"> (opens in new tab)</span></a> and create a sandbox REST app.</li>
                <li>Copy its Client ID and Secret.</li>
                <li>In Lovable Project Settings → Secrets, add <code>PAYPAL_CLIENT_ID</code> and <code>PAYPAL_CLIENT_SECRET</code>. Never paste them into chat.</li>
                <li>Reload this page and click "Test connection".</li>
              </ol>
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">Mode in use: <strong>{sandboxActive ? "PayPal sandbox" : "Demo simulation"}</strong></p>
          <OperatorUnlock />
          <p className="mt-2 text-sm text-muted-foreground">Sandbox actions require an unlocked operator. Invoice access belongs to that two-hour session; locking or signing in again makes its saved sandbox invoices inaccessible. Only use a sandbox buyer account you control.</p>
        </Panel>

        <Panel aria-labelledby="ai-h">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="ai-h" className="flex items-center gap-2 text-lg font-bold text-navy"><Sparkles className="size-5" aria-hidden /> AI assistant</h2>
            {loading ? <Loader2 className="size-4 animate-spin" aria-label="Checking" /> : <Status ok={aiOperational} label={aiLabel} />}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {aiConfigured
              ? "Invoice parsing and reminder drafts use a hosted language model through Lovable AI, called from the server. AI output is always shown for your review and never sent automatically."
              : "Hosted AI isn't available, so a rule-based parser and templates are used. These are clearly labelled as demo."}
          </p>
          {aiCheckedAt && <p className="mt-2 text-xs text-muted-foreground">Last successful structured AI response: {new Date(aiCheckedAt).toLocaleString()}. Verification is per running server and resets after restart.</p>}
        </Panel>

        <Panel aria-labelledby="biz-h">
          <h2 id="biz-h" className="mb-4 text-lg font-bold text-navy">Business profile</h2>
          <form onSubmit={save} className="space-y-4" key={store.hydrated ? "h" : "s"}>
            <div className="space-y-1.5"><Label htmlFor="businessName">Business name</Label><Input id="businessName" name="businessName" defaultValue={store.settings.businessName} className="min-h-11" autoComplete="organization" /></div>
            <div className="space-y-1.5"><Label htmlFor="businessEmail">Business email</Label><Input id="businessEmail" name="businessEmail" type="email" defaultValue={store.settings.businessEmail} className="min-h-11" autoComplete="email" /></div>
            <div className="space-y-1.5"><Label htmlFor="tax">Default tax rate (%)</Label><Input id="tax" name="tax" type="number" min={0} max={100} step="0.1" defaultValue={store.settings.defaultTaxRate} className="min-h-11" /></div>
            <p className="text-sm text-muted-foreground">Currency: USD</p>
            <Button type="submit">Save profile</Button>
          </form>
        </Panel>

        <Panel aria-labelledby="data-h">
          <h2 id="data-h" className="mb-2 text-lg font-bold text-navy">Demo data</h2>
          <p className="text-sm text-muted-foreground">Sample clients and invoices are fictional and marked "Demo". Your data is stored in this browser only.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { if (confirm("Replace all data with fresh demo data?")) { store.resetDemo(); toast.success("Demo data restored"); } }}><RotateCcw aria-hidden /> Reset demo data</Button>
            <Button variant="outline" className="text-destructive" onClick={() => { if (confirm("Delete all clients, invoices and activity?")) { store.clearAll(); toast.success("All data cleared"); } }}><Trash2 aria-hidden /> Start empty</Button>
          </div>
        </Panel>
      </div>
    </>
  );
}