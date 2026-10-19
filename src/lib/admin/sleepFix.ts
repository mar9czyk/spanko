export const STUCK_SLEEP_MIN_AGE_MS = 86_400_000;
export const MAX_SLEEP_DURATION_MS = 86_400_000;

export interface StuckSleepInput {
  readonly status: string;
  /** Początek snu (zaśnięcie albo odłożenie do snu) */
  readonly startIso: string | undefined;
  readonly wokeUpAtIso: string;
  readonly nowMs: number;
}

/**
 * Sprawdza, czy można "naprawić" zawieszony sen, ustawiając mu pobudkę.
 *
 * @description
 * Dozwolone tylko dla niezakończonego snu trwającego od ponad 24 h, z pobudką po początku snu,
 * nie z przyszłości i dającą czas trwania nie dłuższy niż 24 h.
 *
 * @param {StuckSleepInput} input - Status, początek snu, proponowana pobudka i bieżący czas
 * @returns {string | null} Komunikat błędu albo null, gdy naprawa jest dozwolona
 */
export function checkStuckSleepFix(input: StuckSleepInput): string | null {
  if (input.status === "completed") {
    return "Ten sen jest już zakończony.";
  }
  const start = input.startIso ? new Date(input.startIso).getTime() : Number.NaN;
  if (Number.isNaN(start)) {
    return "Sen nie ma poprawnego czasu rozpoczęcia.";
  }
  if (input.nowMs - start < STUCK_SLEEP_MIN_AGE_MS) {
    return "Sen trwa krócej niż 24 h — może być jeszcze aktywny.";
  }
  const end = new Date(input.wokeUpAtIso).getTime();
  if (Number.isNaN(end)) {
    return "Niepoprawny czas pobudki.";
  }
  if (end <= start) {
    return "Pobudka musi być po rozpoczęciu snu.";
  }
  if (end > input.nowMs) {
    return "Pobudka nie może być z przyszłości.";
  }
  if (end - start > MAX_SLEEP_DURATION_MS) {
    return "Sen nie może trwać dłużej niż 24 h.";
  }
  return null;
}
