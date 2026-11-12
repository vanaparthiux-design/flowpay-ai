import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, Mail, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientDialog } from "@/components/app/ClientDialog";
import { DemoTag, EmptyState, PageHeader, StatusBadge } from "@/components/app/ui-bits";
import { displayStatus, formatDate, formatMoney, invoiceTotals } from "@/lib/money";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/clients")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Clients — FlowPay AI" },
      { name: "description", content: "Your clients, their outstanding balances and invoice history." },
      { property: "og:title", content: "Clients — FlowPay AI" },
      { property: "og:description", content: "Your clients and their invoice history." },
    ],
  }),
  component: Clients,
});

function Clients() {
  const { clients, invoices, hydrated } = useStore();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      <PageHeader title="Clients" description="Who you work with and what they owe." actions={<Button onClick={() => setOpen(true)}><UserPlus aria-hidden /> Add client</Button>} />
      {!hydrated ? (
        <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((k) => <Skeleton key={k} className="h-32" />)}</div>
      ) : clients.length === 0 ? (
        <EmptyState icon={<Users />} title="No clients yet" action={<Button onClick={() => setOpen(true)}>Add your first client</Button>}>Add a client to start invoicing.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {clients.map((c) => {
            const inv = invoices.filter((i) => i.clientId === c.id).map((i) => ({ ...i, ds: displayStatus(i), total: invoiceTotals(i).total }));
            const outstanding = inv.filter((i) => i.ds === "sent" || i.ds === "overdue").reduce((s, i) => s + i.total, 0);
            const overdueCount = inv.filter((i) => i.ds === "overdue").length;
            const isOpen = expanded === c.id;
            return (
              <li key={c.id} className="rounded-2xl border bg-card p-5 shadow-card">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft font-bold text-primary-hover">
                    {c.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="flex flex-wrap items-center gap-2 font-bold text-navy">{c.name} {c.demo && <DemoTag>Demo</DemoTag>}</h2>
                    {c.company && <p className="text-sm">{c.company}</p>}
                    <a href={`mailto:${c.email}`} className="inline-flex min-h-11 items-center gap-1 break-all text-sm text-primary hover:underline"><Mail className="size-3.5" aria-hidden />{c.email}</a>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-muted-foreground">Invoices</dt><dd className="font-semibold">{inv.length}</dd></div>
                  <div><dt className="text-muted-foreground">Outstanding</dt><dd className="tabular font-semibold">{formatMoney(outstanding)}</dd></div>
                  <div><dt className="text-muted-foreground">Overdue</dt><dd className={overdueCount ? "font-semibold text-destructive" : "font-semibold"}>{overdueCount}</dd></div>
                </dl>
                <Button variant="ghost" className="mt-3 w-full justify-between" aria-expanded={isOpen} aria-controls={`hist-${c.id}`} onClick={() => setExpanded(isOpen ? null : c.id)}>
                  Invoice history <ChevronDown className={isOpen ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden />
                </Button>
                {isOpen && (
                  <ul id={`hist-${c.id}`} className="mt-2 divide-y border-t">
                    {inv.length === 0 ? <li className="py-3 text-sm text-muted-foreground">No invoices yet.</li> : inv.map((i) => (
                      <li key={i.id}>
                        <Link to="/invoices/$id" params={{ id: i.id }} className="flex min-h-12 flex-wrap items-center gap-2 py-2 text-sm hover:bg-muted">
                          <span className="font-semibold text-primary">{i.number}</span>
                          <span className="text-muted-foreground">{formatDate(i.issueDate)}</span>
                          <span className="ml-auto flex items-center gap-2"><StatusBadge status={i.ds} /><span className="tabular font-semibold">{formatMoney(i.total)}</span></span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ClientDialog open={open} onOpenChange={setOpen} />
    </>
  );
}