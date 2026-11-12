import { AlertTriangle, CheckCircle2, CircleDashed, Clock, FlaskConical, Send, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { DisplayStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS: Record<DisplayStatus, { label: string; cls: string; Icon: typeof Clock }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground border-border", Icon: CircleDashed },
  sent: { label: "Awaiting payment", cls: "bg-primary-soft text-primary-hover border-primary/20", Icon: Send },
  overdue: { label: "Overdue", cls: "bg-destructive-soft text-destructive border-destructive/25", Icon: AlertTriangle },
  paid: { label: "Paid", cls: "bg-success-soft text-success border-success/25", Icon: CheckCircle2 },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground border-border", Icon: XCircle },
};

export const STATUS_LABEL = Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v.label])) as Record<DisplayStatus, string>;

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold", s.cls)}>
      <s.Icon className="size-3.5" aria-hidden />
      {s.label}
    </span>
  );
}

export function DemoTag({ children = "Demo data" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
      <FlaskConical className="size-3" aria-hidden />
      {children}
    </span>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold text-navy sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ className, children, ...p }: React.HTMLAttributes<HTMLElement> & { as?: "section" | "div" }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5 shadow-card sm:p-6", className)} {...p}>
      {children}
    </section>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-primary-soft text-primary" aria-hidden>
        {icon}
      </div>
      <h2 className="text-lg font-bold text-navy">{title}</h2>
      {children && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}