import { formatDate, formatMoney, invoiceTotals, lineTotal } from "@/lib/money";
import type { Client, Invoice, Settings } from "@/lib/types";
import { TERMS_LABEL } from "@/lib/types";

export function InvoicePreview({ invoice, client, settings }: { invoice: Invoice; client?: Client | undefined; settings: Settings }) {
  const t = invoiceTotals(invoice);
  const m = (n: number) => formatMoney(n, invoice.currency);
  return (
    <article aria-label={`Invoice ${invoice.number} preview`} className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <div className="bg-hero px-6 py-5 text-navy-foreground">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm opacity-80">Invoice</p>
            <p className="font-display text-2xl font-extrabold">{invoice.number}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{settings.businessName}</p>
            <p className="opacity-80">{settings.businessEmail}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 border-b px-6 py-5 text-sm sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground">Bill to</p>
          <p className="font-semibold">{client?.name ?? "No client selected"}</p>
          {client?.company && <p>{client.company}</p>}
          {client?.email && <p className="break-all text-muted-foreground">{client.email}</p>}
        </div>
        <div>
          <p className="text-muted-foreground">Issued</p>
          <p className="font-semibold">{formatDate(invoice.issueDate)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Due · {TERMS_LABEL[invoice.terms]}</p>
          <p className="font-semibold">{formatDate(invoice.dueDate)}</p>
        </div>
      </div>
      <div className="overflow-x-auto px-6 py-4">
        <table className="w-full text-sm">
          <caption className="sr-only">Line items</caption>
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th scope="col" className="py-2 font-medium">Description</th>
              <th scope="col" className="py-2 text-right font-medium">Qty</th>
              <th scope="col" className="py-2 text-right font-medium">Rate</th>
              <th scope="col" className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((i) => (
              <tr key={i.id} className="border-b last:border-0">
                <td className="py-2.5 pr-3">{i.description || <span className="text-muted-foreground">Untitled item</span>}</td>
                <td className="tabular py-2.5 text-right">{i.quantity}</td>
                <td className="tabular py-2.5 text-right">{m(i.unitPrice)}</td>
                <td className="tabular py-2.5 text-right font-medium">{m(lineTotal(i))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="ml-auto max-w-xs space-y-1.5 px-6 pb-6 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular">{m(t.subtotal)}</dd></div>
        {t.discount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="tabular">−{m(t.discount)}</dd></div>}
        <div className="flex justify-between"><dt className="text-muted-foreground">Tax ({invoice.taxRate}%)</dt><dd className="tabular">{m(t.tax)}</dd></div>
        <div className="flex justify-between border-t pt-2 text-base font-bold text-navy"><dt>Total due</dt><dd className="tabular">{m(t.total)}</dd></div>
      </dl>
      {invoice.notes && <p className="border-t px-6 py-4 text-sm text-muted-foreground">{invoice.notes}</p>}
    </article>
  );
}