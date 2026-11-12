import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import type { Client } from "@/lib/types";

export function ClientDialog({
  open,
  onOpenChange,
  initialName = "",
  initialEmail = "",
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialName?: string;
  initialEmail?: string;
  onCreated?: (c: Client) => void;
}) {
  const { addClient, announce, clients } = useStore();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") || "").trim();
    const email = String(f.get("email") || "").trim();
    const company = String(f.get("company") || "").trim();
    const errs: Record<string, string> = {};
    if (!name) errs['name'] = "Enter the client's name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs['email'] = "Enter a valid email, e.g. name@company.com.";
    else if (clients.some((c) => c.email.toLowerCase() === email.toLowerCase())) errs['email'] = "A client with this email already exists. Use the existing client instead.";
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`client-${Object.keys(errs)[0]}`)?.focus();
      announce(Object.values(errs).join(" "));
      return;
    }
    const c = addClient({ name, email, company: company || undefined });
    toast.success(`${name} added`);
    announce(`Client ${name} added.`);
    onCreated?.(c);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setErrors({}); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add client</DialogTitle>
          <DialogDescription>Used on invoices. FlowPay never emails reminders for you — you send those yourself.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          {(["name", "email", "company"] as const).map((k) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={`client-${k}`}>
                {k === "name" ? "Full name" : k === "email" ? "Email" : "Company (optional)"}
              </Label>
              <Input
                id={`client-${k}`}
                name={k}
                type={k === "email" ? "email" : "text"}
                autoComplete={k === "email" ? "email" : k === "name" ? "name" : "organization"}
                defaultValue={k === "name" ? initialName : k === "email" ? initialEmail : ""}
                aria-invalid={!!errors[k]}
                aria-describedby={errors[k] ? `client-${k}-err` : undefined}
                className="min-h-11"
              />
              {errors[k] && <p id={`client-${k}-err`} className="text-sm font-medium text-destructive">{errors[k]}</p>}
            </div>
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save client</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}