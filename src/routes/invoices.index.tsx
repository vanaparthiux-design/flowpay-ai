import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownUp, FileText, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DemoTag, EmptyState, PageHeader, StatusBadge, STATUS_LABEL } from "@/components/app/ui-bits";
import { displayStatus, formatDate, formatMoney, invoiceTotals } from "@/lib/money";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/invoices/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Invoices — FlowPay AI" },
      { name: "description", content: "Search, filter and sort all your invoices." },
      { property: "og:title", content: "Invoices — FlowPay AI" },
      { property: "og:description", content: "Search, filter and sort all your invoices." },
    ],
  }),
  component: InvoicesPage,
});

type Sort = "due-asc" | "due-desc" | "amount-desc" | "amount-asc" | "newest";

function InvoicesPage() {
  const { invoices, clients, hydrated } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<Sort>("newest");

  const rows = useMemo(() => {
    const cname = (id: string) => clients.find((c) => c.id === id)?.name ?? "Unknown";
    let r = invoices.map((i) => ({ ...i, ds: displayStatus(i), total: invoiceTotals(i).total, clientName: cname(i.clientId) }));
    const term = q.trim().toLowerCase();
    if (term) r = r.filter((i) => [i.number, i.clientName, ...i.items.map((x) => x.description)].join(" ").toLowerCase().includes(term));
    if (status !== "all") r = r.filter((i) => i.ds === status);
    const cmp: Record<Sort, (a: (typeof r)[0], b: (typeof r)[0]) => number> = {
      "due-asc": (a, b) => a.dueDate.localeCompare(b.dueDate),
      "due-desc": (a, b) => b.dueDate.localeCompare(a.dueDate),
      "amount-desc": (a, b) => b.total - a.total,
      "amount-asc": (a, b) => a.total - b.total,
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    };
    return r.sort(cmp[sort]);
  }, [invoices, clients, q, status, sort]);

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Everything you've billed, in one place."
        actions={<Button asChild><Link to="/invoices/new"><Plus aria-hidden /> New invoice</Link></Button>}
      />

      <div role="search" className="mb-5 grid gap-3 sm:grid-cols-[1fr_200px_200px]">
        <div className="space-y-1.5">
          <Label htmlFor="inv-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="inv-search" value={q} onChange={(e) => setQ(e.target.value)} className="min-h-11 bg-card pl-9" placeholder="Number, client or item" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-status" id="inv-status-label">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="inv-status" aria-labelledby="inv-status-label inv-status" className="min-h-11 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(["draft", "sent", "overdue", "paid", "cancelled"] as const).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-sort" id="inv-sort-label">Sort by</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger id="inv-sort" aria-labelledby="inv-sort-label inv-sort" className="min-h-11 bg-card"><ArrowDownUp className="size-4" aria-hidden /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="due-asc">Due date (soonest)</SelectItem>
              <SelectItem value="due-desc">Due date (latest)</SelectItem>
              <SelectItem value="amount-desc">Amount (high to low)</SelectItem>
              <SelectItem value="amount-asc">Amount (low to high)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">{hydrated ? `${rows.length} invoice${rows.length === 1 ? "" : "s"}` : "Loading invoices…"}</p>

      {!hydrated ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((k) => <Skeleton key={k} className="h-16" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title={invoices.length ? "No invoices match" : "No invoices yet"}
          action={invoices.length ? <Button variant="outline" onClick={() => { setQ(""); setStatus("all"); }}>Clear filters</Button> : <Button asChild><Link to="/assistant">Create one with AI</Link></Button>}
        >
          {invoices.length ? "Try a different search or status." : "Describe your work and FlowPay drafts the invoice."}
        </EmptyState>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-card md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Invoices, sorted {sort}</caption>
              <thead className="bg-muted text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Invoice</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Client</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Due</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((i) => (
                  <tr key={i.id} className="hover:bg-muted/60">
                    <td className="px-4 py-3">
                      <Link to="/invoices/$id" params={{ id: i.id }} className="font-semibold text-primary hover:underline">{i.number}</Link>
                      <span className="block max-w-56 truncate text-xs text-muted-foreground">{i.items[0]?.description}</span>
                    </td>
                    <td className="px-4 py-3">{i.clientName} {i.demo && <span className="ml-1"><DemoTag>Demo</DemoTag></span>}</td>
                    <td className="px-4 py-3"><StatusBadge status={i.ds} /></td>
                    <td className="px-4 py-3">{formatDate(i.dueDate)}</td>
                    <td className="tabular px-4 py-3 text-right font-semibold">{formatMoney(i.total, i.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 md:hidden">
            {rows.map((i) => (
              <li key={i.id}>
                <Link to="/invoices/$id" params={{ id: i.id }} className="block rounded-2xl border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-navy">{i.clientName}</p>
                      <p className="text-sm text-muted-foreground">{i.number} · due {formatDate(i.dueDate)}</p>
                    </div>
                    <p className="tabular font-bold">{formatMoney(i.total, i.currency)}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2"><StatusBadge status={i.ds} />{i.demo && <DemoTag>Demo</DemoTag>}</div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}