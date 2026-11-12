import { useEffect, useRef } from "react";

/**
 * Returns keyboard focus to the element that opened a dialog when it closes or unmounts.
 * Radix cannot do this when the dialog has no <DialogTrigger> or is conditionally mounted.
 * The opener is captured during render, before Radix moves focus into the dialog.
 */
export function useReturnFocus(open: boolean) {
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current && typeof document !== "undefined") {
    const el = document.activeElement;
    opener.current = el instanceof HTMLElement && el !== document.body ? el : null;
  }
  wasOpen.current = open;
  // Only restore when focus was dropped to <body>; never steal focus from elsewhere
  // (also makes React StrictMode's simulated unmount harmless).
  const restore = () => {
    const el = opener.current;
    if (el) setTimeout(() => {
      const active = document.activeElement;
      if (el.isConnected && (!active || active === document.body)) el.focus();
    }, 0);
  };
  // Real close: always return focus (the closing dialog may still hold it during its exit animation).
  useEffect(() => {
    if (open) return;
    const el = opener.current;
    opener.current = null;
    if (el) setTimeout(() => { if (el.isConnected) el.focus(); }, 0);
  }, [open]);
  useEffect(() => () => restore(), []);
  /** Pass to DialogContent/AlertDialogContent onCloseAutoFocus. */
  return (e: Event) => { if (opener.current) e.preventDefault(); };
}