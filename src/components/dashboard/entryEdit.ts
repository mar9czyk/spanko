import type {
  DayContextRecord,
  InterventionLevel,
  NightWakingDetail,
  SleepLogRecord,
  SleepMood,
} from "@/lib/types/database";
import { BREAST_MAX_MIN, BREAST_STEP_MIN } from "./constants";
import type { TimelineEvent } from "./types";

const MS_PER_DAY = 86_400_000;
/** Górna granica czasu usypiania w formularzu edycji. */
export const MAX_FALL_ASLEEP_MIN = 240;
const CLOCK_PATTERN = /^(\d{2}):(\d{2})$/;

/** Godziny wpisu w formularzu edycji (HH:mm, czas lokalny urządzenia). */
export interface EntryTimeDraft {
  readonly start: string;
  /** Tylko sen: godzina pobudki. */
  readonly end?: string;
  /** Tylko butelka: nowa ilość mleka w ml. */
  readonly bottleMl?: number;
  /** Tylko pierś: czas karmienia w minutach; brak pola = bez zmiany. */
  readonly breastMinutes?: number;
  /** Tylko sen: czas usypiania w minutach (odłożenie → zaśnięcie); brak pola = bez zmiany. */
  readonly fallAsleepMin?: number;
  /** Tylko sen: nastrój przy zasypianiu; null = wyczyść, brak pola = bez zmiany. */
  readonly mood?: SleepMood | null;
  /** Tylko sen: co pomogło przy zasypianiu; brak pola = bez zmiany. */
  readonly interventions?: readonly InterventionLevel[];
  /** Tylko sen: pełna lista pobudek nocnych; brak pola = bez zmiany. */
  readonly nightWakings?: readonly NightWakingDetail[];
}

export type EntryEditError =
  | "invalid_time"
  | "end_before_start"
  | "in_future"
  | "waking_outside_sleep";

export type EntryEditPatch =
  | {
      readonly collection: "sleep_logs";
      readonly id: string;
      readonly patch: Partial<
        Pick<
          SleepLogRecord,
          "fell_asleep_at" | "put_down_at" | "woke_up_at" | "interventions" | "night_wakings"
        >
      > & { readonly mood?: SleepMood | "" };
    }
  | {
      readonly collection: "day_context";
      readonly id: string;
      readonly patch: Pick<DayContextRecord, "timestamp"> &
        Partial<Pick<DayContextRecord, "bottle_ml" | "breast_left_min" | "breast_right_min">>;
    };

/**
 * Przesuwa minuty karmienia piersią o krok (5 min) do wielokrotności kroku, w granicach 0–120.
 *
 * @param {number} current - Bieżące minuty
 * @param {1 | -1} direction - Kierunek zmiany
 * @returns {number} Nowe minuty
 */
export function stepBreastMinutes(current: number, direction: 1 | -1): number {
  const snapped =
    direction === 1
      ? (Math.floor(current / BREAST_STEP_MIN) + 1) * BREAST_STEP_MIN
      : (Math.ceil(current / BREAST_STEP_MIN) - 1) * BREAST_STEP_MIN;
  return Math.min(BREAST_MAX_MIN, Math.max(0, snapped));
}

/**
 * Formatuje moment ISO do wartości pola `<input type="time">` (HH:mm, czas lokalny).
 *
 * @param {string | undefined} iso - Moment ISO
 * @returns {string} Godzina HH:mm albo pusty tekst
 */
export function toClockInputValue(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Pierwszy moment nie wcześniejszy niż `afterIso`, w którym zegar pokazuje HH:mm.
 *
 * @param {string} afterIso - Dolna granica (początek snu)
 * @param {string} clock - Godzina HH:mm
 * @returns {string | null} Moment ISO albo null przy błędnej godzinie
 */
export function clockAfterIso(afterIso: string, clock: string): string | null {
  const match = CLOCK_PATTERN.exec(clock);
  const after = new Date(afterIso);
  if (!match || Number.isNaN(after.getTime())) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  const candidate = new Date(after);
  candidate.setHours(hours, minutes, 0, 0);
  if (candidate.getTime() < after.getTime()) candidate.setDate(candidate.getDate() + 1);
  return candidate.toISOString();
}

/**
 * Ustawia godzinę HH:mm (czas lokalny) na momencie najbliższym pierwotnemu.
 *
 * @description
 * Wpis o 00:30 przestawiony na 23:50 trafia na poprzedni wieczór, a nie na koniec tego
 * samego dnia kalendarzowego — korekta godziny nie przenosi wpisu o dobę.
 *
 * @param {string} originalIso - Pierwotny moment wpisu
 * @param {string} clock - Nowa godzina HH:mm
 * @returns {string | null} Nowy moment ISO albo null przy błędnej godzinie
 */
export function applyClockTime(originalIso: string, clock: string): string | null {
  const match = CLOCK_PATTERN.exec(clock);
  const original = new Date(originalIso);
  if (!match || Number.isNaN(original.getTime())) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  const sameDay = new Date(original);
  sameDay.setHours(hours, minutes, 0, 0);
  const candidates = [-1, 0, 1].map((deltaDays) => {
    const candidate = new Date(sameDay);
    candidate.setDate(sameDay.getDate() + deltaDays);
    return candidate;
  });
  const nearest = candidates.reduce((best, candidate) =>
    Math.abs(candidate.getTime() - original.getTime()) <
    Math.abs(best.getTime() - original.getTime())
      ? candidate
      : best,
  );
  return Math.abs(nearest.getTime() - original.getTime()) < MS_PER_DAY
    ? nearest.toISOString()
    : null;
}

/**
 * Zamienia nowe godziny wpisu z osi czasu na zmianę rekordu w PocketBase.
 *
 * @description
 * Sen: zmienia początek (zaśnięcie albo odłożenie, zależnie od tego, które pole wyznacza
 * start) i pobudkę; odłożenie późniejsze niż nowe zaśnięcie przesuwa razem z nim.
 * Karmienie, pielucha, tagi: zmienia `timestamp`; butelka dodatkowo `bottle_ml`. Doba fizjologiczna wpisu się nie zmienia.
 *
 * @param {TimelineEvent} event - Edytowany wpis
 * @param {EntryTimeDraft} draft - Nowe godziny HH:mm
 * @param {string} nowIso - Bieżący moment (wpis nie może trafić w przyszłość)
 * @returns {EntryEditPatch | EntryEditError} Zmiana rekordu albo kod błędu
 */
export function buildEntryTimePatch(
  event: TimelineEvent,
  draft: EntryTimeDraft,
  nowIso: string,
): EntryEditPatch | EntryEditError {
  const nowMs = Date.parse(nowIso);
  if (event.kind !== "nap") {
    if (!event.timeIso) return "invalid_time";
    const timestamp = applyClockTime(event.timeIso, draft.start);
    if (!timestamp) return "invalid_time";
    if (Date.parse(timestamp) > nowMs) return "in_future";
    const bottleMl =
      event.kind === "feeding" && event.feedingType === "bottle" ? draft.bottleMl : undefined;
    const breastMinutes =
      event.kind === "feeding" && event.feedingType === "breast" && event.breastSide
        ? draft.breastMinutes
        : undefined;
    return {
      collection: "day_context",
      id: event.id,
      patch: {
        timestamp,
        ...(bottleMl === undefined ? {} : { bottle_ml: bottleMl }),
        ...(breastMinutes === undefined
          ? {}
          : event.kind === "feeding" && event.breastSide === "right"
            ? { breast_right_min: breastMinutes }
            : { breast_left_min: breastMinutes }),
      },
    };
  }

  if (!event.startIso) return "invalid_time";
  const start = applyClockTime(event.startIso, draft.start);
  const end = event.endIso && draft.end ? applyClockTime(event.endIso, draft.end) : undefined;
  if (!start || end === null) return "invalid_time";
  if (end && Date.parse(end) <= Date.parse(start)) return "end_before_start";
  if (Date.parse(end ?? start) > nowMs) return "in_future";
  const windowEndMs = Date.parse(end ?? event.endIso ?? nowIso);
  if (
    draft.nightWakings?.some((waking) => {
      const wakingMs = Date.parse(waking.wokeAt);
      return wakingMs < Date.parse(start) || wakingMs > windowEndMs;
    })
  ) {
    return "waking_outside_sleep";
  }

  const fallAsleepMin = draft.fallAsleepMin;
  if (
    fallAsleepMin !== undefined &&
    (!Number.isInteger(fallAsleepMin) || fallAsleepMin < 0 || fallAsleepMin > MAX_FALL_ASLEEP_MIN)
  ) {
    return "invalid_time";
  }
  const putDownFromLatency =
    event.startField === "fell_asleep_at" && fallAsleepMin !== undefined
      ? new Date(Date.parse(start) - fallAsleepMin * 60_000).toISOString()
      : undefined;

  const patch: Extract<EntryEditPatch, { collection: "sleep_logs" }>["patch"] = {
    ...(event.startField === "put_down_at" ? { put_down_at: start } : { fell_asleep_at: start }),
    ...(putDownFromLatency ? { put_down_at: putDownFromLatency } : {}),
    ...(putDownFromLatency === undefined &&
    event.startField === "fell_asleep_at" &&
    event.putDownIso &&
    Date.parse(event.putDownIso) > Date.parse(start)
      ? { put_down_at: start }
      : {}),
    ...(end ? { woke_up_at: end } : {}),
    ...(draft.mood === undefined ? {} : { mood: draft.mood ?? "" }),
    ...(draft.interventions === undefined ? {} : { interventions: draft.interventions }),
    ...(draft.nightWakings === undefined
      ? {}
      : {
          night_wakings: [...draft.nightWakings].sort((a, b) => a.wokeAt.localeCompare(b.wokeAt)),
        }),
  };
  return { collection: "sleep_logs", id: event.id, patch };
}

/** Rekord do usunięcia: kolekcja PocketBase i id wpisu. */
export interface EntryDeleteTarget {
  readonly collection: "sleep_logs" | "day_context";
  readonly id: string;
}

/**
 * Wskazuje rekord, który usuwa przycisk „Usuń wpis” w arkuszu edycji.
 *
 * @description
 * Sen żyje w `sleep_logs`, karmienie, pielucha i tagi w `day_context`. Trwającego snu nie da się
 * tu usunąć (kończy go przycisk „Wstał”), więc dla niego zwraca null.
 *
 * @param {TimelineEvent} event - Wpis z osi czasu
 * @returns {EntryDeleteTarget | null} Rekord do usunięcia albo null, gdy usuwanie jest niedostępne
 */
export function entryDeleteTarget(event: TimelineEvent): EntryDeleteTarget | null {
  if (event.kind === "nap") {
    return event.status === "completed" ? { collection: "sleep_logs", id: event.id } : null;
  }
  return { collection: "day_context", id: event.id };
}
