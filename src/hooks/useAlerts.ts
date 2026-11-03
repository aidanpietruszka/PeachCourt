import { useEffect, useMemo, useState } from "react";
import { AlertService, type Alert } from "../services/AlertService";

export function useAlerts(uid: string | null): {
  alerts: Alert[];
  unreadCount: number;
} {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    if (!uid) {
      setAlerts([]);
      return;
    }
    return AlertService.subscribeToAlerts(uid, setAlerts, (err) => {
      console.error("Unable to load alerts", err);
    });
  }, [uid]);

  const unreadCount = useMemo(() => alerts.filter((a) => !a.read).length, [alerts]);

  return { alerts, unreadCount };
}
