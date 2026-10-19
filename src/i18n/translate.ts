import { en, type MessageKey, pl } from "./messages";

export type Locale = "pl" | "en";
export type Units = "metric" | "imperial";
export type TranslateParams = Readonly<Record<string, string | number>>;

export const DEFAULT_LOCALE: Locale = "en";
export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "pl"];

const DICTIONARIES: Readonly<Record<Locale, Readonly<Record<string, string>>>> = { pl, en };
const ML_PER_FLUID_OUNCE = 29.5735;
const IMPERIAL_BOTTLE_OZ = [2, 3, 4, 5, 6] as const;
const METRIC_BOTTLE_ML = [60, 90, 120, 150, 180] as const;

/**
 * Tłumaczy klucz i podstawia parametry `{name}`.
 *
 * @param {Locale} locale - Język
 * @param {MessageKey} key - Klucz słownika
 * @param {TranslateParams} [params] - Parametry do podstawienia
 * @returns {string} Tekst w wybranym języku
 */
export function translate(locale: Locale, key: MessageKey, params?: TranslateParams): string {
  return interpolate(DICTIONARIES[locale][key] ?? key, params);
}

/**
 * Tłumaczy klucz dynamiczny (np. tag użytkownika); brak klucza = `fallback`.
 *
 * @param {Locale} locale - Język
 * @param {string} key - Klucz słownika
 * @param {string} fallback - Tekst, gdy klucza brak
 * @returns {string} Tekst w wybranym języku lub fallback
 */
export function translateDynamic(locale: Locale, key: string, fallback: string): string {
  return DICTIONARIES[locale][key] ?? fallback;
}

/**
 * Jak `translateDynamic`, ale z nadpisaniami treści ustawianymi przez admina (kolekcja `app_content`).
 *
 * @description
 * Nadpisania są polskie (`value_pl`), więc działają tylko dla języka polskiego; pusta wartość
 * jest ignorowana i używany jest tekst z kodu.
 *
 * @param {Locale} locale - Język
 * @param {string} key - Klucz tłumaczenia (np. `tag.ząbkowanie`)
 * @param {string} fallback - Tekst, gdy klucza brak
 * @param {Readonly<Record<string, string>>} overrides - Nadpisania z bazy (klucz → treść)
 * @returns {string} Tekst do wyświetlenia
 */
export function translateDynamicWithOverrides(
  locale: Locale,
  key: string,
  fallback: string,
  overrides: Readonly<Record<string, string>>,
): string {
  const override = locale === "pl" ? overrides[key] : undefined;
  return override && override.trim() !== "" ? override : translateDynamic(locale, key, fallback);
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Wykrywa język z ustawień przeglądarki (polski → pl, reszta → en).
 *
 * @param {string | undefined} browserLanguage - np. navigator.language
 * @returns {Locale} Wykryty język
 */
export function detectLocale(browserLanguage: string | undefined): Locale {
  return browserLanguage?.toLowerCase().startsWith("pl") ? "pl" : DEFAULT_LOCALE;
}

/**
 * Domyślne jednostki: oz tylko dla en-US, w pozostałych przypadkach ml.
 *
 * @param {string | undefined} browserLanguage - np. navigator.language
 * @returns {Units} Domyślne jednostki objętości
 */
export function detectUnits(browserLanguage: string | undefined): Units {
  return browserLanguage?.toLowerCase() === "en-us" ? "imperial" : "metric";
}

/**
 * Formatuje objętość zapisaną w ml do wybranych jednostek.
 *
 * @param {number} ml - Objętość w mililitrach
 * @param {Units} units - Jednostki wyświetlania
 * @returns {string} np. "120 ml" lub "4 oz"
 */
export function formatVolume(ml: number, units: Units): string {
  if (units === "imperial") {
    const oz = Math.round((ml / ML_PER_FLUID_OUNCE) * 2) / 2;
    return `${oz} oz`;
  }
  return `${ml} ml`;
}

/**
 * Formatuje czas trwania w minutach jako godziny i minuty (np. 110 → „1h 50 min”).
 *
 * @description
 * Zapis „h” i „min” jest czytelny w obu językach (PL i EN), więc nie zależy od locale.
 * Poniżej godziny zwraca same minuty, pełne godziny bez „0 min”.
 *
 * @param {number} minutes - Czas trwania w minutach
 * @returns {string} Tekst, np. „45 min”, „2h”, „1h 50 min”
 */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest} min`;
}

/**
 * Presety butelki: zawsze w ml (do zapisu), z etykietą w jednostkach użytkownika.
 *
 * @param {Units} units - Jednostki wyświetlania
 * @returns {readonly { ml: number; label: string }[]} Presety
 */
export function bottlePresets(units: Units): readonly { ml: number; label: string }[] {
  if (units === "imperial") {
    return IMPERIAL_BOTTLE_OZ.map((oz) => ({
      ml: Math.round(oz * ML_PER_FLUID_OUNCE),
      label: `${oz} oz`,
    }));
  }
  return METRIC_BOTTLE_ML.map((ml) => ({ ml, label: `${ml} ml` }));
}

/**
 * Locale BCP-47 do formatowania dat i godzin.
 *
 * @param {Locale} locale - Język aplikacji
 * @returns {string} Znacznik języka
 */
export function dateLocaleTag(locale: Locale): string {
  return locale === "pl" ? "pl-PL" : "en-US";
}
