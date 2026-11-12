import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addDaysISO, todayISO } from "./money";
import type { Activity, ActivityType, Client, Invoice, Settings } from "./types";

const KEY = "flowpay-ai-v1";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

interface State {
  clients: Client[];
  invoices: Invoice[];
  activity: Activity[];
  settings: Settings;
  nextNumber: number;
}

const defaultSettings: Settings = {
  businessName: "Studio Rivera Design",
  businessEmail: "hello@studiorivera.example",
  currency: "USD",
  defaultTaxRate: 0,
  useSandbox: true,
};

export function seedState(): State {
  const t = todayISO();
  const now = new Date().toISOString();
  const c = (id: string, name: string, email: string, company: string): Client => ({ id, name, email, company, createdAt: now, demo: true });
  const clients = [
    c("c1", "Alex Morgan", "alex@northwind.example", "Northwind Coffee"),
    c("c2", "Priya Shah", "priya@lumen.example", "Lumen Health"),
    c("c3", "Diego Alvarez", "diego@alvarezbuilds.example", "Alvarez Builds"),
    c("c4", "Hannah Kim", "hannah@paperkite.example", "Paperkite Books"),
  ];
  const inv = (
    n: number, clientId: string, desc: string, qty: number, price: number, issueOffset: number, dueOffset: number, status: Invoice["status"],
  ): Invoice => ({
    id: `i${n}`,
    number: `FP-${1000 + n}`,
    clientId,
    items: [{ id: uid(), description: desc, quantity: qty, unitPrice: price }],
    taxRate: 0,
    discount: 0,
    currency: "USD",
    issueDate: addDaysISO(t, issueOffset),
    dueDate: addDaysISO(t, dueOffset),
    terms: "NET_30",
    status,
    channel: status === "draft" ? undefined : "demo",
    sentAt: status !== "draft" ? addDaysISO(t, issueOffset) + "T15:00:00.000Z" : undefined,
    paidAt: status === "paid" ? addDaysISO(t, dueOffset - 3) + "T15:00:00.000Z" : undefined,
    createdAt: addDaysISO(t, issueOffset) + "T14:00:00.000Z",
    source: "manual",
    demo: true,
  });
  const invoices = [
    inv(1, "c1", "Brand identity refresh", 1, 2400, -75, -45, "sent"),
    inv(2, "c2", "Website UX audit", 16, 110, -50, -20, "sent"),
    inv(3, "c3", "Logo & signage concepts", 1, 950, -40, -6, "sent"),
    inv(4, "c4", "Book cover design", 2, 650, -12, 18, "sent"),
    inv(5, "c1", "Menu illustration set", 10, 85, -5, 25, "sent"),
    inv(6, "c2", "Landing page design", 1, 1800, -60, -30, "paid"),
    inv(7, "c4", "Social media templates", 8, 75, -35, -5, "paid"),
    inv(8, "c3", "Brochure layout", 6, 120, 0, 30, "draft"),
  ];
  // Demo-only example of a user-entered situation, so judges can see "promised → wait".
  invoices[1]!.circumstance = { kind: "promised", date: addDaysISO(t, 4), note: "Demo: client said payment run is Friday.", updatedAt: now };
  const activity: Activity[] = invoices
    .filter((i) => i.status !== "draft")
    .map((i): Activity => ({ id: uid(), at: i.sentAt!, type: "invoice_sent" as const, message: `${i.number} sent (demo data)`, invoiceId: i.id }))
    .concat(
      invoices.filter((i) => i.paidAt).map((i): Activity => ({ id: uid(), at: i.paidAt!, type: "invoice_paid" as const, message: `${i.number} marked paid (demo data)`, invoiceId: i.id })),
    )
    .sort((a, b) => b.at.localeCompare(a.at));
  return { clients, invoices, activity, settings: defaultSettings, nextNumber: 1009 };
}

interface Store extends State {
  hydrated: boolean;
  announce: (msg: string) => void;
  addClient: (c: Omit<Client, "id" | "createdAt">) => Client;
  upsertInvoice: (inv: Invoice) => void;
  patchInvoice: (id: string, patch: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  log: (type: ActivityType, message: string, refs?: { invoiceId?: string; clientId?: string; contactAt?: string; contactChannel?: string }) => void;
  takeInvoiceNumber: () => string;
  updateSettings: (s: Partial<Settings>) => void;
  resetDemo: () => void;
  clearAll: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => seedState());
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("");
  const numRef = useRef(state.nextNumber);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<State>;
        // Defensive: corrupted/partial saved data falls back to empty arrays instead of crashing the app.
        if (parsed && typeof parsed === "object") {
          const next: State = {
            clients: Array.isArray(parsed.clients) ? parsed.clients : [],
            invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
            activity: Array.isArray(parsed.activity) ? parsed.activity : [],
            settings: { ...defaultSettings, ...(parsed.settings ?? {}) },
            nextNumber: Number.isFinite(parsed.nextNumber) ? (parsed.nextNumber as number) : 1001,
          };
          setState(next);
          numRef.current = next.nextNumber;
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const announce = useCallback((msg: string) => {
    setMessage("");
    setTimeout(() => setMessage(msg), 50);
  }, []);

  const log = useCallback<Store["log"]>((type, message, refs) => {
    setState((s) => ({ ...s, activity: [{ id: uid(), at: new Date().toISOString(), type, message, ...refs }, ...s.activity].slice(0, 500) }));
  }, []);

  const store = useMemo<Store>(
    () => ({
      ...state,
      hydrated,
      announce,
      log,
      addClient: (c) => {
        const client: Client = { ...c, id: uid(), createdAt: new Date().toISOString() };
        setState((s) => ({
          ...s,
          clients: [...s.clients, client],
          activity: [{ id: uid(), at: client.createdAt, type: "client_created" as const, message: `Client ${client.name} added`, clientId: client.id }, ...s.activity],
        }));
        return client;
      },
      upsertInvoice: (inv) =>
        setState((s) => {
          const exists = s.invoices.some((i) => i.id === inv.id);
          return { ...s, invoices: exists ? s.invoices.map((i) => (i.id === inv.id ? inv : i)) : [inv, ...s.invoices] };
        }),
      patchInvoice: (id, patch) => setState((s) => ({ ...s, invoices: s.invoices.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
      deleteInvoice: (id) => setState((s) => ({ ...s, invoices: s.invoices.filter((i) => i.id !== id) })),
      takeInvoiceNumber: () => {
        const n = numRef.current++;
        setState((s) => ({ ...s, nextNumber: numRef.current }));
        return `FP-${n}`;
      },
      updateSettings: (p) => setState((s) => ({ ...s, settings: { ...s.settings, ...p } })),
      resetDemo: () => {
        const s = seedState();
        numRef.current = s.nextNumber;
        setState(s);
      },
      clearAll: () => {
        numRef.current = 1001;
        setState((s) => ({ clients: [], invoices: [], activity: [], settings: s.settings, nextNumber: 1001 }));
      },
    }),
    [state, hydrated, announce, log],
  );

  return (
    <Ctx.Provider value={store}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </div>
    </Ctx.Provider>
  );
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}