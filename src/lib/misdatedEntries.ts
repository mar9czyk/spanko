import { pb } from "@/lib/pocketbase";
import { formatDateToCalendarString } from "@/lib/sleep-engine";
import type { SleepLogRecord } from "@/lib/types/database";

/** Rekord z datą doby i momentem zdarzenia (day_context albo sen). */
export interface DatedEntry {
  readonly id: string;
  readonly physiological_date: string;
  readonly at: string;
}

/**
 * Data doby, do której naprawdę należy wpis zapisany po porannej pobudce zakończonej nocy.
 *
 * @description
 * Wpisy dodane, gdy noc jeszcze „trwała” w aplikacji (pobudka zapisana później), dostają datę
 * doby nocy, choć wypadają po pobudce. Poprawna data to dzień kalendarzowy pobudki.
 *
 * @param {Pick<SleepLogRecord, "physiological_date" | "woke_up_at">} night - Zakończona noc
 * @param {string} timeZone - Strefa IANA dziecka
 * @param {readonly DatedEntry[]} entries - Wpisy z datą doby nocy
 * @returns {{ id: string; physiological_date: string }[]} Wpisy do przeniesienia
 */
export function findMisdatedEntries(
  night: Pick<SleepLogRecord, "physiological_date" | "woke_up_at">,
  timeZone: string,
  entries: readonly DatedEntry[],
): { id: string; physiological_date: string }[] {
  if (!night.woke_up_at) return [];
  const wakeMs = Date.parse(night.woke_up_at);
  const wakeDate = formatDateToCalendarString(new Date(wakeMs), timeZone);
  if (wakeDate === night.physiological_date) return [];
  return entries
    .filter(
      (entry) =>
        entry.physiological_date === night.physiological_date && Date.parse(entry.at) >= wakeMs,
    )
    .map((entry) => ({ id: entry.id, physiological_date: wakeDate }));
}

/**
 * Przenosi do właściwej doby wpisy (karmienia, pieluchy, drzemki) zapisane po pobudce nocy
 * pod datą doby tej nocy. Idempotentne; błędy są ciche, bo to tylko samonaprawa.
 *
 * @param {string} childId - Dziecko
 * @param {SleepLogRecord} night - Ostatnia zakończona noc
 * @param {string} timeZone - Strefa IANA dziecka
 * @returns {Promise<number>} Liczba przeniesionych wpisów
 */
export async function repairMisdatedEntries(
  childId: string,
  night: SleepLogRecord,
  timeZone: string,
): Promise<number> {
  if (night.status !== "completed" || !night.woke_up_at) return 0;
  try {
    const params = { childId, date: night.physiological_date, wake: night.woke_up_at };
    const [contexts, naps] = await Promise.all([
      pb.collection("day_context").getFullList<{ id: string; timestamp: string }>({
        filter: pb.filter(
          "child_id = {:childId} && physiological_date = {:date} && timestamp >= {:wake}",
          params,
        ),
      }),
      pb.collection("sleep_logs").getFullList<SleepLogRecord>({
        filter: pb.filter(
          "child_id = {:childId} && physiological_date = {:date} && type = 'nap' && created >= {:wake}",
          params,
        ),
      }),
    ]);
    const base = { physiological_date: night.physiological_date };
    const fix = (collection: "day_context" | "sleep_logs", entries: DatedEntry[]) =>
      findMisdatedEntries(night, timeZone, entries).map((patch) =>
        pb
          .collection(collection)
          .update(patch.id, { physiological_date: patch.physiological_date }),
      );
    const updates = [
      ...fix(
        "day_context",
        contexts.map((r) => ({ id: r.id, ...base, at: r.timestamp })),
      ),
      ...fix(
        "sleep_logs",
        naps.flatMap((r) => {
          const at = r.fell_asleep_at || r.put_down_at;
          return at ? [{ id: r.id, ...base, at }] : [];
        }),
      ),
    ];
    await Promise.all(updates);
    return updates.length;
  } catch {
    return 0;
  }
}
