import { useQuery } from "@tanstack/react-query";
import { getAiStatus } from "./ai.functions";
import { getPaypalStatus } from "./paypal.functions";
import { useStore } from "./store";
import { aiStatusLabel } from "./integration-status";
import { getOperatorStatus } from "./operator.functions";

export function useIntegrations() {
  const { settings } = useStore();
  const pp = useQuery({ queryKey: ["paypal-status"], queryFn: () => getPaypalStatus(), staleTime: 60_000 });
  const ai = useQuery({ queryKey: ["ai-status"], queryFn: () => getAiStatus(), staleTime: 10_000, refetchInterval: 10_000 });
  const paypalConfigured = pp.data?.configured ?? false;
  const operator = useQuery({ queryKey: ["operator-status"], queryFn: () => getOperatorStatus(), staleTime: 0, refetchInterval: 30_000 });
  return {
    loading: pp.isLoading || ai.isLoading,
    paypalConfigured,
    sandboxActive: paypalConfigured && settings.useSandbox,
    operatorUnlocked: operator.data?.unlocked ?? false,
    aiConfigured: ai.data?.configured ?? false,
    aiOperational: ai.data?.operational ?? false,
    aiLabel: aiStatusLabel(ai.data ?? { configured: false, operational: false, checkedAt: null, lastFailureAt: null }),
    aiCheckedAt: ai.data?.checkedAt,
    error: pp.error || ai.error,
  };
}