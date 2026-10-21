"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadDaysRange } from "@/lib/client-data";
import { buildPastDay, type PastDayView, shiftPhysiologicalDate } from "./dayHistory";

export type PastDaysStatus = "idle" | "loading" | "ready" | "error";

/**
 * Ładuje zamknięte doby fizjologiczne dziecka: `count` dób kończących się na `lastDate`
 * (najnowsza pierwsza), razem z nocą sprzed pierwszej doby, która ją otwiera.
 *
 * @param {string | undefined} childId - Id dziecka
 * @param {string | null} lastDate - Najnowsza doba YYYY-MM-DD; null = nic nie ładuj
 * @param {number} count - Liczba dób
 * @returns {object} Status, doby i `reload` (np. po edycji wpisu)
 */
export function usePastDays(childId: string | undefined, lastDate: string | null, count: number) {
  const [status, setStatus] = useState<PastDaysStatus>("idle");
  const [days, setDays] = useState<readonly PastDayView[]>([]);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const loadedKeyRef = useRef<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: version celowo przeładowuje doby po edycji wpisu
  useEffect(() => {
    if (!childId || !lastDate) {
      loadedKeyRef.current = null;
      setStatus("idle");
      setDays([]);
      return;
    }
    let isCurrent = true;
    // Przeładowanie tych samych dób (po edycji) zostawia stare dane do czasu nowych
    const key = `${childId}|${lastDate}|${count}`;
    if (loadedKeyRef.current !== key) {
      loadedKeyRef.current = key;
      setStatus("loading");
      setDays([]);
    }
    const dates = Array.from({ length: count }, (_, index) =>
      shiftPhysiologicalDate(lastDate, -index),
    );
    loadDaysRange(childId, shiftPhysiologicalDate(lastDate, -count), lastDate)
      .then(({ logs, contexts }) => {
        if (!isCurrent) return;
        setDays(dates.map((date) => buildPastDay(date, logs, contexts)));
        setStatus("ready");
      })
      .catch(() => {
        if (isCurrent) setStatus("error");
      });
    return () => {
      isCurrent = false;
    };
  }, [childId, lastDate, count, version]);

  return { status, days, reload };
}
