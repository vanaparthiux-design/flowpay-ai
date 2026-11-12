import { cn } from "@/lib/utils";

export function Logo({ inverted }: { inverted?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M5 16c3 0 4-8 7-8s4 8 7 8" />
        </svg>
      </span>
      <span className={cn("whitespace-nowrap font-display text-lg font-extrabold tracking-tight", inverted ? "text-sidebar-accent-foreground" : "text-navy")}>
        FlowPay <span className={inverted ? "text-sidebar-foreground" : "text-primary"}>AI</span>
      </span>
    </span>
  );
}