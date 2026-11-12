import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, FileText, LayoutDashboard, Menu, Settings, Sparkles, Users, Plus } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { useIntegrations } from "@/lib/integrations";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/assistant", label: "AI Assistant", icon: Sparkles },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const SHORT: Record<string, string> = { "AI Assistant": "AI", Dashboard: "Home" };
const PRIMARY = NAV.filter((n) => ["/", "/invoices", "/assistant"].includes(n.to));
const MORE = NAV.filter((n) => ["/clients", "/activity", "/settings"].includes(n.to));

function useActive() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (to: string) => (to === "/" ? path === "/" : path.startsWith(to));
}

export function AppShell({ children }: { children: ReactNode }) {
  const isActive = useActive();
  const { sandboxActive } = useIntegrations();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE.some((n) => isActive(n.to));
  const tab = (active: boolean) => cn(
    "relative flex min-h-16 w-full flex-col items-center justify-center gap-1 px-1 text-xs font-semibold leading-tight",
    active ? "text-primary before:absolute before:inset-x-4 before:top-0 before:h-0.5 before:rounded-full before:bg-primary" : "text-muted-foreground hover:text-foreground",
  );
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-card focus:px-4 focus:py-3 focus:font-semibold focus:text-foreground focus:shadow-card"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-16 items-center px-6">
          <Link to="/" className="rounded-md" aria-label="FlowPay AI home">
            <Logo inverted />
          </Link>
        </div>
        <nav aria-label="Main" className="flex-1 px-3 py-4">
          <ul className="space-y-1">
            {NAV.map((n) => (
              <li key={n.to}>
                <Link
                  to={n.to}
                  aria-current={isActive(n.to) ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-sidebar-ring",
                    isActive(n.to)
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <n.icon className="size-5" aria-hidden />
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="m-3 rounded-xl border border-sidebar-border p-4 text-xs">
          <p className="flex items-center gap-2 font-semibold text-sidebar-accent-foreground">
            <span aria-hidden className={cn("size-2 rounded-full", sandboxActive ? "bg-success-soft" : "bg-warning-soft")} />
            {sandboxActive ? "Sandbox credentials found" : "Demo mode"}
          </p>
          <p className="mt-1 leading-relaxed">
            {sandboxActive ? "Sandbox invoice actions are security-locked. No real money." : "Sending is simulated locally. No real money moves."}
          </p>
          <p className="mt-2 opacity-80">Independent project — not affiliated with PayPal.</p>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex min-h-14 items-center justify-between gap-1 border-b bg-card/95 px-3 min-[360px]:gap-2 min-[360px]:px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
        <Link to="/" aria-label="FlowPay AI home" className="rounded-md">
          <Logo />
        </Link>
        <Link to="/settings" className={cn("ml-auto inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-2 text-xs font-semibold", sandboxActive ? "text-success" : "text-warning")}>
          {sandboxActive ? "Sandbox" : "Demo mode"}
        </Link>
        <Button asChild size="sm">
          <Link to="/invoices/new" aria-label="New invoice">
            <Plus aria-hidden /> New
          </Link>
        </Button>
      </header>

      <main id="main" tabIndex={-1} className="pb-[calc(5rem+env(safe-area-inset-bottom))] outline-none lg:pb-10 lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-8px_oklch(0.31_0.12_262/0.15)] lg:hidden">
        <ul className="grid grid-cols-4">
          {PRIMARY.map((n) => (
            <li key={n.to}>
              <Link to={n.to} aria-current={isActive(n.to) ? "page" : undefined} className={tab(isActive(n.to))}>
                <n.icon className="size-5" aria-hidden />
                <span className="max-w-full truncate">{SHORT[n.label] ?? n.label}</span>
              </Link>
            </li>
          ))}
          <li>
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
              <SheetTrigger asChild>
                <button type="button" className={tab(moreActive)} aria-label={moreActive ? "More (current section inside)" : "More"}>
                  <Menu className="size-5" aria-hidden />
                  <span>More</span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                <SheetHeader className="text-left">
                  <SheetTitle>More</SheetTitle>
                  <SheetDescription>Clients, activity history and settings.</SheetDescription>
                </SheetHeader>
                <nav aria-label="More sections" className="mt-4">
                  <ul className="space-y-1">
                    {MORE.map((n) => (
                      <li key={n.to}>
                        <Link
                          to={n.to}
                          onClick={() => setMoreOpen(false)}
                          aria-current={isActive(n.to) ? "page" : undefined}
                          className={cn("flex min-h-12 items-center gap-3 rounded-lg px-3 text-base font-semibold", isActive(n.to) ? "bg-primary-soft text-primary" : "hover:bg-muted")}
                        >
                          <n.icon className="size-5" aria-hidden /> {n.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
                <p className="mt-4 text-xs text-muted-foreground">Independent project — not affiliated with or endorsed by PayPal.</p>
              </SheetContent>
            </Sheet>
          </li>
        </ul>
      </nav>
    </div>
  );
}