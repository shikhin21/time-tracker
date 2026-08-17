import { useEffect, useMemo, useState } from "react";
import type { EntryRow } from "../db/db";
import { getEntriesInRange } from "../db/entriesRepo";
import { sumByDay } from "../lib/totals";
import { useAppStore } from "../store/appStore";

/** Entries + per-day quarter totals for [fromKey, toKey], refetched whenever
 *  any mutation bumps the store's dataVersion. */
export function useEntriesRange(
  projectId: string | null,
  fromKey: string,
  toKey: string,
) {
  const dataVersion = useAppStore((s) => s.dataVersion);
  const [entries, setEntries] = useState<EntryRow[]>([]);

  useEffect(() => {
    if (!projectId) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    getEntriesInRange(projectId, fromKey, toKey).then((rows) => {
      if (!cancelled) setEntries(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, fromKey, toKey, dataVersion]);

  const dayTotals = useMemo(() => sumByDay(entries), [entries]);
  return { entries, dayTotals };
}
