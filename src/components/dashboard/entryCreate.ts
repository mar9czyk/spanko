import type { BreastSide, DiaperKind, SleepType } from "@/lib/types/database";
import type { PastDayView } from "./dayHistory";
import type { TimelineEvent } from "./types";

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const CLOCK_PATTERN = /^(\d{2}):(\d{2})$/;
/** Godzina, od której liczymy dobę bez zapisanej porannej pobudki. */
const FALLBACK_DAY_START_HOUR = 4;
/** Najdłuższy sen, jaki da się dopisać ręcznie. */
const MAX_SLEEP_HOURS = 16;

export type ManualEntryError =
  | "invalid_time"
  | "end_before_start"
  | "in_future"
  | "outside_day"
  | "overlap"
  | "no_night_sleep";

/** Co użytkownik chce dopisać do minionej doby. */
export type ManualEntryDraft =
  | {
      readonly kind: "sleep";
      readonly sleepType: SleepType;
      readonly start: string;
      readonly end: string;
    }
  | { readonly kind: "breast"; readonly time: string; readonly side: BreastSide }
  | { readonly kind: "bottle"; readonly time: string; readonly ml: number }
  | { readonly kind: "diaper"; readonly time: string; readonly diaperKind: DiaperKind }
  | { readonly kind: "night_waking"; readonly time: string };

/** Pola nowego rekordu; `child_id`, strefę i autora dokłada zapis. */
export type ManualEntryRecord =
  | {
      /** Pobudka nocna dopisywana do istniejącego snu nocnego (nie osobny rekord). */
      readonly collection: "night_waking";
      readonly logId: string;
      readonly wokeAt: string;
    }
  | {
      readonly collection: "sleep_logs";
      readonly data: {
        readonly physiological_date: string;
        readonly type: SleepType;
        readonly status: "completed";
        readonly put_down_at: string;
        readonly fell_asleep_at: string;
        readonly woke_up_at: string;
        readonly interventions: readonly never[];
        readonly night_wakings: readonly never[];
        readonly is_rebound_sleep: false;
        readonly ignore_in_calibration: false;
      };
    }
  | {
      readonly collection: "day_context";
      readonly data: {
        readonly physiological_date: string;
        readonly timestamp: string;
        readonly event_type: "feeding" | "diaper";
        readonly feeding_type: "breast" | "bottle" | "none";
        readonly breast_side?: BreastSide;
        readonly bottle_ml?: number;
        readonly diaper_kind?: DiaperKind;
      };
    };

/**
 * Granice doby fizjologicznej: od porannej pobudki (albo 04:00 daty doby) do pobudki
 * następnego ranka (albo 24 h później).
 *
 * @param {PastDayView} day - Doba, do której dopisujemy wpis
 * @returns {{ startMs: number; endMs: number }} Okno doby w ms
 */
export function dayWindow(day: Pick<PastDayView, "date" | "dayStartIso" | "dayEndIso">): {
  startMs: number;
  endMs: number;
} {
  const [year = 0, month = 1, dom = 1] = day.date.split("-").map(Number);
  const startMs = day.dayStartIso
    ? Date.parse(day.dayStartIso)
    : new Date(year, month - 1, dom, FALLBACK_DAY_START_HOUR).getTime();
  const endMs = day.dayEndIso ? Date.parse(day.dayEndIso) : startMs + MS_PER_DAY;
  return { startMs, endMs };
}

/**
 * Zamienia godzinę HH:mm na pierwszy moment nie wcześniejszy niż `afterMs`. Godziny „przed”
 * początkiem doby wypadają więc po północy następnego dnia kalendarzowego.
 *
 * @param {string} clock - Godzina HH:mm (czas lokalny)
 * @param {number} afterMs - Dolna granica
 * @param {boolean} strict - true = moment musi być późniejszy niż granica
 * @returns {number | null} Moment w ms albo null przy błędnej godzinie
 */
function nextClockAfter(clock: string, afterMs: number, strict: boolean): number | null {
  const match = CLOCK_PATTERN.exec(clock);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  const candidate = new Date(afterMs);
  candidate.setHours(hours, minutes, 0, 0);
  if (strict ? candidate.getTime() <= afterMs : candidate.getTime() < afterMs) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.getTime();
}

/**
 * Dopina drzemki i noce doby jako przedziały [początek, koniec] w ms.
 *
 * @param {readonly TimelineEvent[]} events - Wpisy doby
 * @returns {{ startMs: number; endMs: number }[]} Zajęte przedziały snu
 */
function sleepIntervals(events: readonly TimelineEvent[]): { startMs: number; endMs: number }[] {
  return events.flatMap((event) => {
    if (event.kind !== "nap" || !event.startIso || !event.endIso) return [];
    return [{ startMs: Date.parse(event.startIso), endMs: Date.parse(event.endIso) }];
  });
}

/**
 * Buduje rekord ręcznie dopisywanego wpisu w minionej dobie i go waliduje.
 *
 * @description
 * Wpis dostaje `physiological_date` tej doby. Godziny przed poranną pobudką doby trafiają na
 * następny dzień kalendarzowy (np. 00:40 po wieczornym karmieniu). Walidacja: poprawna
 * godzina, nie w przyszłości, wewnątrz doby, koniec snu po początku, sny się nie nakładają.
 *
 * @param {PastDayView} day - Doba z granicami i wpisami
 * @param {ManualEntryDraft} draft - Dane z formularza
 * @param {string} nowIso - Bieżący moment
 * @returns {ManualEntryRecord | ManualEntryError} Rekord do zapisu albo kod błędu
 */
export function buildManualEntry(
  day: PastDayView,
  draft: ManualEntryDraft,
  nowIso: string,
): ManualEntryRecord | ManualEntryError {
  const { startMs: windowStart, endMs: windowEnd } = dayWindow(day);
  const nowMs = Date.parse(nowIso);
  const physiologicalDate = day.date;

  if (draft.kind === "sleep") {
    const startMs = nextClockAfter(draft.start, windowStart, false);
    if (startMs === null) return "invalid_time";
    const endMs = nextClockAfter(draft.end, startMs, true);
    if (endMs === null) return "invalid_time";
    if (endMs - startMs > MAX_SLEEP_HOURS * MS_PER_HOUR) return "end_before_start";
    if (startMs >= windowEnd || endMs > windowEnd) return "outside_day";
    if (endMs > nowMs) return "in_future";
    if (sleepIntervals(day.events).some((slot) => startMs < slot.endMs && endMs > slot.startMs)) {
      return "overlap";
    }
    const startIso = new Date(startMs).toISOString();
    return {
      collection: "sleep_logs",
      data: {
        physiological_date: physiologicalDate,
        type: draft.sleepType,
        status: "completed",
        put_down_at: startIso,
        fell_asleep_at: startIso,
        woke_up_at: new Date(endMs).toISOString(),
        interventions: [],
        night_wakings: [],
        is_rebound_sleep: false,
        ignore_in_calibration: false,
      },
    };
  }

  const timeMs = nextClockAfter(draft.time, windowStart, false);
  if (timeMs === null) return "invalid_time";
  if (timeMs >= windowEnd) return "outside_day";
  if (timeMs > nowMs) return "in_future";
  const timestamp = new Date(timeMs).toISOString();
  if (draft.kind === "night_waking") {
    const night = day.events.find(
      (event) =>
        event.kind === "nap" &&
        event.type === "night" &&
        event.startIso !== undefined &&
        event.endIso !== undefined &&
        Date.parse(event.startIso) <= timeMs &&
        timeMs <= Date.parse(event.endIso),
    );
    if (!night) return "no_night_sleep";
    return { collection: "night_waking", logId: night.id, wokeAt: timestamp };
  }
  if (draft.kind === "diaper") {
    return {
      collection: "day_context",
      data: {
        physiological_date: physiologicalDate,
        timestamp,
        event_type: "diaper",
        feeding_type: "none",
        diaper_kind: draft.diaperKind,
      },
    };
  }
  return {
    collection: "day_context",
    data: {
      physiological_date: physiologicalDate,
      timestamp,
      event_type: "feeding",
      feeding_type: draft.kind,
      ...(draft.kind === "breast" ? { breast_side: draft.side } : { bottle_ml: draft.ml }),
    },
  };
}
