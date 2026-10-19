"use client";

import { useEffect, useState } from "react";
import { shiftPhysiologicalDate } from "@/components/dashboard/dayHistory";
import { usePastDays } from "@/components/dashboard/usePastDays";
import { loadActiveChild } from "@/lib/client-data";
import { pb } from "@/lib/pocketbase";
import { DEFAULT_TIME_ZONE, resolvePhysiologicalDate } from "@/lib/sleep-engine";
import type { ChildRecord, SleepLogRecord } from "@/lib/types/database";

export const HISTORY_DAYS = 14;

/**
 * Stan ekranu Historia: aktywne dziecko i jego zamknięte doby sprzed bieżącej.
 *
 * @description
 * Bieżącą dobę wyznacza tak samo jak pulpit (ostatnia noc + strefa dziecka), a potem ładuje
 * {@link HISTORY_DAYS} wcześniejszych dób, najnowsza pierwsza.
 *
 * @returns {object} Dziecko, status i doby
 */
export function useHistoryState() {
  const [child, setChild] = useState<ChildRecord | null>(null);
  const [lastDate, setLastDate] = useState<string | null>(null);
  const [setupStatus, setSetupStatus] = useState<"loading" | "ready" | "empty" | "error">(
    "loading",
  );

  useEffect(() => {
    let isCurrent = true;
    (async () => {
      const activeChild = await loadActiveChild();
      if (!activeChild) {
        if (isCurrent) setSetupStatus("empty");
        return;
      }
      const nights = await pb.collection("sleep_logs").getList<SleepLogRecord>(1, 1, {
        filter: pb.filter("child_id = {:childId} && type = 'night'", { childId: activeChild.id }),
        sort: "-created",
      });
      const latestNight = nights.items[0];
      const nowIso = new Date().toISOString();
      const today = resolvePhysiologicalDate({
        eventTimestamp: nowIso,
        timeZone: activeChild.timezone || DEFAULT_TIME_ZONE,
        activeOrRecentNightSleep: latestNight
          ? {
              physiologicalDate: latestNight.physiological_date,
              fellAsleepAt: latestNight.fell_asleep_at || latestNight.put_down_at || nowIso,
              wokeUpAt: latestNight.woke_up_at,
            }
          : null,
      });
      if (!isCurrent) return;
      setChild(activeChild);
      setLastDate(shiftPhysiologicalDate(today, -1));
      setSetupStatus("ready");
    })().catch(() => {
      if (isCurrent) setSetupStatus("error");
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  const { status: daysStatus, days } = usePastDays(child?.id, lastDate, HISTORY_DAYS);
  const status = setupStatus === "ready" ? daysStatus : setupStatus;
  return {
    child,
    status: status === "idle" ? "loading" : status,
    days: days.filter((day) => day.events.length > 0),
  };
}
