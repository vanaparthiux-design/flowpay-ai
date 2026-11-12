export type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled";
export type DisplayStatus = InvoiceStatus | "overdue";
export type PaymentTerms = "DUE_ON_RECEIPT" | "NET_7" | "NET_14" | "NET_30" | "NET_45" | "CUSTOM";

export const TERMS_LABEL: Record<PaymentTerms, string> = {
  DUE_ON_RECEIPT: "Due on receipt",
  NET_7: "Net 7",
  NET_14: "Net 14",
  NET_30: "Net 30",
  NET_45: "Net 45",
  CUSTOM: "Custom date",
};
export const TERMS_DAYS: Record<PaymentTerms, number | null> = {
  DUE_ON_RECEIPT: 0,
  NET_7: 7,
  NET_14: 14,
  NET_30: 30,
  NET_45: 45,
  CUSTOM: null,
};

export interface Client {
  id: string;
  name: string;
  email: string;
  company?: string | undefined;
  createdAt: string;
  demo?: boolean | undefined;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  number: string;
  clientId: string;
  items: LineItem[];
  taxRate: number;
  discount: number;
  currency: string;
  issueDate: string; // yyyy-mm-dd
  dueDate: string; // yyyy-mm-dd
  terms: PaymentTerms;
  notes?: string | undefined;
  status: InvoiceStatus;
  /** Where the invoice was sent: local simulation or PayPal sandbox. */
  channel?: "demo" | "paypal_sandbox" | undefined;
  paypalInvoiceId?: string | undefined;
  /** Signed session-bound capability; never sufficient without the HttpOnly operator cookie. */
  paypalOwnershipProof?: string | undefined;
  paypalStatus?: string | undefined;
  paypalLink?: string | undefined;
  /** Content fingerprint the PayPal draft was created from. */
  paypalVersion?: string | undefined;
  paypalCheckedAt?: string | undefined;
  sentAt?: string | undefined;
  paidAt?: string | undefined;
  createdAt: string;
  source?: "manual" | "ai" | undefined;
  demo?: boolean | undefined;
  circumstance?: Circumstance | undefined;
}

export type ActivityType =
  | "invoice_created"
  | "invoice_updated"
  | "invoice_sent"
  | "invoice_paid"
  | "paypal_draft"
  | "paypal_error"
  /** LEGACY (pre-fix): recorded on approval of a simulated reminder. Never counted as real contact. */
  | "reminder_sent"
  /** User approved/copied a reminder draft. Nothing was delivered. */
  | "reminder_draft_approved"
  /** User explicitly confirmed they contacted the client outside FlowPay. Self-reported, not verified. */
  | "reminder_confirmed_external"
  | "circumstance_updated"
  | "client_created"
  | "ai_generated";

export interface Activity {
  id: string;
  at: string;
  type: ActivityType;
  message: string;
  invoiceId?: string | undefined;
  clientId?: string | undefined;
  /** For reminder_confirmed_external: when the user says they contacted the client (ISO). */
  contactAt?: string | undefined;
  /** For reminder_confirmed_external: self-reported channel, e.g. "email". */
  contactChannel?: string | undefined;
}

export type CircumstanceKind = "none" | "promised" | "disputed" | "contacted_elsewhere";
export const CIRCUMSTANCE_LABEL: Record<CircumstanceKind, string> = {
  none: "No known issue",
  promised: "Payment promised",
  disputed: "Invoice disputed",
  contacted_elsewhere: "Contacted elsewhere",
};
/** User-entered context about the client's situation. Never inferred by FlowPay. */
export interface Circumstance {
  kind: CircumstanceKind;
  /** yyyy-mm-dd: expected payment date (promised) or contact date (contacted_elsewhere). */
  date?: string | undefined;
  note?: string | undefined;
  updatedAt: string;
}

export interface Settings {
  businessName: string;
  businessEmail: string;
  currency: string;
  defaultTaxRate: number;
  useSandbox: boolean;
}