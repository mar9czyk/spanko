import { isContactSleepPlace } from "../sleep-environment";
import type { SleepLog } from "./types";

/** Ile ostatnich dób bierzemy do oceny miejsc drzemek. */
export const NAP_PLACE_SAMPLE_DAYS = 7;
/** Najmniej drzemek w próbce, żeby wyciągać wnioski. */
export const NAP_PLACE_MIN_NAPS = 4;
/** Udział drzemek kontaktowych, od którego mówimy o przewadze kontaktu. */
export const CONTACT_DOMINANT_SHARE = 0.5;
/** Drzemka kontaktowa tyle razy dłuższa od pozostałych = sen „trzyma się” kontaktu. */
export const CONTACT_LONGER_RATIO = 1.5;

export type NapPlaceSignalCode =
  | "NAP_PLACE_NO_DATA"
  | "NAP_PLACE_NO_CONTACT"
  | "NAP_PLACE_CONTACT_PRESENT"
  | "NAP_PLACE_CONTACT_DEPENDENT";

export interface NapPlaceAnalysis {
  readonly code: NapPlaceSignalCode;
  readonly napCount: number;
  readonly contactNapCount: number;
  /** Udział drzemek kontaktowych (0–1) albo null przy braku drzemek. */
  readonly contactShare: number | null;
  readonly contactMedianMin: number | null;
  /** Mediana pozostałych drzemek w miejscu (bez ruchu i kontaktu). */
  readonly otherMedianMin: number | null;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0
      ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
      : (sorted[mid] ?? 0);
  return Math.round(value);
}

function napMinutes(log: SleepLog): number {
  if (!log.wokeUpAt) return 0;
  const start = new Date(log.fellAsleepAt || log.putDownAt).getTime();
  return Math.max(0, Math.round((new Date(log.wokeUpAt).getTime() - start) / 60_000));
}

/**
 * Porównuje drzemki kontaktowe (na rodzicu) z drzemkami w łóżku z ostatnich dób.
 *
 * @description
 * Deterministyczny sygnał dla porad i wniosków AI; nie zmienia okien, długu ani diagnoz.
 * Sen kontaktowy liczy się minuta w minutę jak każdy inny. `NAP_PLACE_CONTACT_DEPENDENT`:
 * co najmniej połowa drzemek jest kontaktowa i są one wyraźnie dłuższe od pozostałych
 * (albo pozostałych brak), czyli dziecko dobrze śpi tylko na rodzicu. Drzemki w ruchu
 * (wózek, auto) są pomijane, bo opisuje je inna ścieżka. Progi to heurystyki (H).
 *
 * @param {readonly SleepLog[]} logs - Logi snu (dowolna kolejność)
 * @returns {NapPlaceAnalysis} Statystyki i kod sygnału
 */
export function analyzeNapPlaces(logs: readonly SleepLog[]): NapPlaceAnalysis {
  const naps = logs.filter((l) => l.type === "nap" && l.status === "completed");
  const dates = [...new Set(naps.map((n) => n.physiologicalDate))]
    .toSorted()
    .reverse()
    .slice(0, NAP_PLACE_SAMPLE_DAYS);
  const sample = naps.filter(
    (n) =>
      dates.includes(n.physiologicalDate) &&
      n.sleepPlace !== "stroller" &&
      n.sleepPlace !== "car_seat",
  );
  const contact = sample.filter((n) => isContactSleepPlace(n.sleepPlace));
  const other = sample.filter((n) => !isContactSleepPlace(n.sleepPlace));
  const contactMedianMin = median(contact.map(napMinutes));
  const otherMedianMin = median(other.map(napMinutes));
  const contactShare = sample.length === 0 ? null : contact.length / sample.length;

  let code: NapPlaceSignalCode = "NAP_PLACE_NO_CONTACT";
  if (sample.length === 0) code = "NAP_PLACE_NO_DATA";
  else if (contact.length > 0) {
    const dominant =
      sample.length >= NAP_PLACE_MIN_NAPS &&
      (contactShare ?? 0) >= CONTACT_DOMINANT_SHARE &&
      (otherMedianMin === null || (contactMedianMin ?? 0) >= otherMedianMin * CONTACT_LONGER_RATIO);
    code = dominant ? "NAP_PLACE_CONTACT_DEPENDENT" : "NAP_PLACE_CONTACT_PRESENT";
  }
  return {
    code,
    napCount: sample.length,
    contactNapCount: contact.length,
    contactShare,
    contactMedianMin,
    otherMedianMin,
  };
}

/**
 * Jednozdaniowy opis sygnału dla AI (stałe zdania, liczby z silnika); null, gdy brak kontaktu.
 *
 * @param {NapPlaceAnalysis} analysis - Wynik `analyzeNapPlaces`
 * @returns {string | null} Opis do promptu albo null
 */
export function describeNapPlaceSignal(analysis: NapPlaceAnalysis): string | null {
  if (analysis.contactNapCount === 0) return null;
  const share = Math.round((analysis.contactShare ?? 0) * 100);
  const base = `${analysis.contactNapCount} z ${analysis.napCount} drzemek (${share}%) było kontaktowych (na rodzicu), mediana ${analysis.contactMedianMin ?? 0} min`;
  const other =
    analysis.otherMedianMin === null
      ? "brak drzemek poza kontaktem"
      : `pozostałe drzemki mediana ${analysis.otherMedianMin} min`;
  const dependent =
    analysis.code === "NAP_PLACE_CONTACT_DEPENDENT"
      ? " Sygnał: dziecko długo śpi głównie na rodzicu; sen kontaktowy jest pełnowartościowy, ale warto łagodnie ćwiczyć drzemki poza kontaktem."
      : "";
  return `${base}; ${other} [${analysis.code}].${dependent}`;
}
