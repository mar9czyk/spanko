"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { MessageKey } from "./messages";
import {
  DEFAULT_LOCALE,
  detectLocale,
  detectUnits,
  type Locale,
  SUPPORTED_LOCALES,
  type TranslateParams,
  translate,
  translateDynamic,
  type Units,
} from "./translate";

const LOCALE_STORAGE_KEY = "spanko.locale";
const UNITS_STORAGE_KEY = "spanko.units";

interface I18nContextValue {
  readonly locale: Locale;
  readonly units: Units;
  readonly setLocale: (locale: Locale) => void;
  readonly setUnits: (units: Units) => void;
  readonly t: (key: MessageKey, params?: TranslateParams) => string;
  readonly tDynamic: (key: string, fallback: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  units: "metric",
  setLocale: () => undefined,
  setUnits: () => undefined,
  t: (key, params) => translate(DEFAULT_LOCALE, key, params),
  tDynamic: (key, fallback) => translateDynamic(DEFAULT_LOCALE, key, fallback),
});

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Prywatne okno lub zablokowane dane witryny — preferencja działa tylko w tej sesji
  }
}

/**
 * Dostawca języka i jednostek. Kolejność: zapisany wybór → ustawienia przeglądarki → angielski.
 *
 * @param {object} props - Elementy potomne
 * @returns {ReactNode} Kontekst i18n
 */
export function I18nProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [units, setUnitsState] = useState<Units>("metric");

  useEffect(() => {
    const storedLocale = readStorage(LOCALE_STORAGE_KEY);
    const storedUnits = readStorage(UNITS_STORAGE_KEY);
    const browserLanguage = window.navigator.language;
    setLocaleState(
      SUPPORTED_LOCALES.find((l) => l === storedLocale) ?? detectLocale(browserLanguage),
    );
    setUnitsState(
      storedUnits === "metric" || storedUnits === "imperial"
        ? storedUnits
        : detectUnits(browserLanguage),
    );
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeStorage(LOCALE_STORAGE_KEY, next);
  }, []);

  const setUnits = useCallback((next: Units) => {
    setUnitsState(next);
    writeStorage(UNITS_STORAGE_KEY, next);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      units,
      setLocale,
      setUnits,
      t: (key, params) => translate(locale, key, params),
      tDynamic: (key, fallback) => translateDynamic(locale, key, fallback),
    }),
    [locale, units, setLocale, setUnits],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Hook dostępu do tłumaczeń, języka i jednostek.
 *
 * @returns {I18nContextValue} Aktualny kontekst i18n
 */
export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
