import { useEffect, useMemo, useState } from "react";
import { AlertService, type Alert } from "../services/AlertService";
import { useListenerError } from "./useListenerError";

export function useAlerts(uid: string | null): {
  alerts: Alert[];
  unreadCount: number;
  error: boolean;
  retry: () => void;
} {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const { errored, retryKey, handleError, retry } = useListenerError("alerts");

  useEffect(() => {
    if (!uid) {
      setAlerts([]);
      return;
    }
    return AlertService.subscribeToAlerts(uid, setAlerts, handleError);
  }, [uid, retryKey, handleError]);

  const unreadCount = useMemo(() => alerts.filter((a) => !a.read).length, [alerts]);

  return { alerts, unreadCount, error: errored, retry };
}
