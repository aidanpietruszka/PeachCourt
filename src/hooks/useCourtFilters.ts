import { useCallback, useEffect, useState } from "react";
import {
  loadFilters,
  saveFilters,
  type CourtFilters,
} from "../utils/courtFilters";

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function useCourtFilters(): [
  CourtFilters,
  (update: (current: CourtFilters) => CourtFilters) => void,
] {
  const [filters, setFilters] = useState<CourtFilters>(() =>
    loadFilters(browserStorage()),
  );

  useEffect(() => {
    saveFilters(browserStorage(), filters);
  }, [filters]);

  const change = useCallback(
    (update: (current: CourtFilters) => CourtFilters) => setFilters(update),
    [],
  );

  return [filters, change];
}
