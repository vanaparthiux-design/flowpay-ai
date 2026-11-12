/** Pure builders/mappers for the PayPal Invoicing v2 API (unit-tested, no I/O). */
export interface DraftInput {
  localId: string;
  number: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  notes?: string | undefined;
  taxRate: number;
  discount: number;
  invoicer: { businessName: string };
  recipient: { name: string; email: string };
  items: { description: string; quantity: number; unitPrice: number }[];
}

/** Stable per local invoice so retries never create a second PayPal invoice number. */
export function paypalInvoiceNumber(number: string, localId: string) {
  return `${number}-${localId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}`.slice(0, 25);
}

export function buildDraftPayload(input: DraftInput) {
  const [given, ...rest] = input.recipient.name.trim().split(/\s+/);
  const money = (v: number) => ({ currency_code: input.currency, value: v.toFixed(2) });
  return {
    detail: {
      invoice_number: paypalInvoiceNumber(input.number, input.localId),
      currency_code: input.currency,
      invoice_date: input.issueDate,
      payment_term: { due_date: input.dueDate },
      ...(input.notes ? { note: input.notes.slice(0, 4000) } : {}),
      memo: "Created with FlowPay AI (sandbox test)",
    },
    invoicer: { business_name: input.invoicer.businessName.slice(0, 300) },
    primary_recipients: [
      {
        billing_info: {
          name: { given_name: (given || input.recipient.name).slice(0, 140), ...(rest.length ? { surname: rest.join(" ").slice(0, 140) } : {}) },
          email_address: input.recipient.email,
        },
      },
    ],
    items: input.items.map((i) => ({
      name: (i.description.trim() || "Services").slice(0, 200),
      quantity: String(i.quantity),
      unit_amount: money(i.unitPrice),
      unit_of_measure: "QUANTITY",
      ...(input.taxRate > 0 ? { tax: { name: "Tax", percent: String(input.taxRate) } } : {}),
    })),
    ...(input.discount > 0 ? { amount: { breakdown: { discount: { invoice_discount: { amount: money(input.discount) } } } } } : {}),
    configuration: { allow_tip: false, tax_calculated_after_discount: true, tax_inclusive: false },
  };
}

export type LocalStatus = "draft" | "sent" | "paid" | "cancelled";

/** Maps PayPal invoice status to FlowPay's local status. Unknown values keep the current status. */
export function mapPaypalStatus(status: string | undefined, current: LocalStatus): LocalStatus {
  switch (status) {
    case "DRAFT":
      return "draft";
    case "SENT":
    case "UNPAID":
    case "SCHEDULED":
    case "PARTIALLY_PAID":
    case "PAYMENT_PENDING":
      return "sent";
    case "PAID":
    case "MARKED_AS_PAID":
      return "paid";
    case "CANCELLED":
    case "REFUNDED":
    case "MARKED_AS_REFUNDED":
      return "cancelled";
    default:
      return current;
  }
}

/** Statuses that prove PayPal has delivered the invoice. A re-send must not be attempted. */
export const DELIVERED_STATUSES = ["SENT", "UNPAID", "SCHEDULED", "PARTIALLY_PAID", "PAYMENT_PENDING", "PAID", "MARKED_AS_PAID"];