import { useEffect, useState } from "react";
import type { RateRow } from "../db/db";
import { getRates } from "../db/ratesRepo";
import { useAppStore } from "../store/appStore";

/** A project's rate rows ordered by effectiveDate, refetched on mutations. */
export function useRates(projectId: string | null) {
  const dataVersion = useAppStore((s) => s.dataVersion);
  const [rates, setRates] = useState<RateRow[]>([]);

  useEffect(() => {
    if (!projectId) {
      setRates([]);
      return;
    }
    let cancelled = false;
    getRates(projectId).then((rows) => {
      if (!cancelled) setRates(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, dataVersion]);

  return rates;
}
