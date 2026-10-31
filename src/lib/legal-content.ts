import type { Locale } from "@/i18n/translate";

export interface LegalSection {
  readonly heading: string;
  readonly body: string;
}

export interface LegalDocument {
  readonly title: string;
  readonly draftNote: string;
  readonly sections: readonly LegalSection[];
}

export type LegalKind = "terms" | "privacy";

/**
 * Treść regulaminu i polityki prywatności (SZKIC — wymaga weryfikacji prawnej przed publicznym startem).
 */
export const LEGAL_CONTENT: Readonly<Record<LegalKind, Readonly<Record<Locale, LegalDocument>>>> = {
  terms: {
    pl: {
      title: "Regulamin",
      draftNote: "Wersja robocza (2026-10). Treść wymaga weryfikacji prawnej.",
      sections: [
        {
          heading: "Czym jest Spanko",
          body: "Spanko to aplikacja do zapisywania snu i rutyny dziecka oraz podpowiadania rytmu dnia. Nie jest wyrobem medycznym i nie zastępuje porady lekarza lub pielęgniarki.",
        },
        {
          heading: "Konto i rodzina",
          body: "Konto zakłada rodzic lub opiekun prawny. Dostęp do danych dziecka mają wyłącznie osoby należące do tej samej rodziny, czyli te, które dołączyły kodem zaproszenia. Kod ważny jest 24 godziny.",
        },
        {
          heading: "Podpowiedzi",
          body: "Okna czuwania i bilans snu liczy deterministyczny silnik, a komunikaty tekstowe może przygotować AI. To sugestie, a nie zalecenia medyczne. W razie niepokoju skontaktuj się z lekarzem.",
        },
        {
          heading: "Usunięcie konta",
          body: "Konto i dane możesz usunąć w Ustawieniach. Gdy jesteś ostatnim członkiem rodziny, usuwane są także dane dziecka.",
        },
      ],
    },
    en: {
      title: "Terms of service",
      draftNote: "Draft (2026-10). Legal review pending.",
      sections: [
        {
          heading: "What Spanko is",
          body: "Spanko records a baby's sleep and routine and suggests a daily rhythm. It is not a medical device and does not replace advice from a doctor or nurse.",
        },
        {
          heading: "Account and family",
          body: "The account is created by a parent or legal guardian. Only people in the same family, who joined with an invite code, can see the child's data. Codes are valid for 24 hours.",
        },
        {
          heading: "Suggestions",
          body: "Wake windows and sleep balance are computed by a deterministic engine; text messages may be written by AI. They are suggestions, not medical advice. If you are worried, contact a doctor.",
        },
        {
          heading: "Deleting your account",
          body: "You can delete your account and data in Settings. If you are the last family member, the child's data is deleted too.",
        },
      ],
    },
  },
  privacy: {
    pl: {
      title: "Polityka prywatności",
      draftNote: "Wersja robocza (2026-10). Treść wymaga weryfikacji prawnej.",
      sections: [
        {
          heading: "Jakie dane zbieramy",
          body: "E-mail i imię rodzica, dane dziecka (imię, data urodzenia, zapisy snu i rutyny) oraz dane techniczne niezbędne do działania aplikacji. Dane o dziecku są danymi dotyczącymi zdrowia, dlatego prosimy o odrębną zgodę.",
        },
        {
          heading: "Wnioski AI (OpenRouter)",
          body: "Jeśli włączysz zgodę na AI, zanonimizowane podsumowanie snu dziecka (bez imienia i e-maila) jest wysyłane do dostawcy modeli OpenRouter w celu przygotowania komunikatu. Bez zgody AI nie jest używane, a liczby nadal wylicza silnik deterministyczny. Zgodę wycofasz w Ustawieniach.",
        },
        {
          heading: "Gdzie są dane",
          body: "Dane przechowujemy na serwerze aplikacji. Codziennie wykonujemy kopię zapasową bazy.",
        },
        {
          heading: "Twoje prawa",
          body: "Masz prawo dostępu, sprostowania, usunięcia i przenoszenia danych oraz wycofania zgody. Usunięcie konta znajdziesz w Ustawieniach.",
        },
      ],
    },
    en: {
      title: "Privacy policy",
      draftNote: "Draft (2026-10). Legal review pending.",
      sections: [
        {
          heading: "What we collect",
          body: "The parent's email and name, the child's data (name, birth date, sleep and routine records) and technical data needed to run the app. Data about the child is health data, so we ask for a separate consent.",
        },
        {
          heading: "AI insights (OpenRouter)",
          body: "If you consent to AI, an anonymised summary of the child's sleep (no name or email) is sent to the model provider OpenRouter to write a message. Without consent AI is not used and the numbers are still computed by the deterministic engine. You can withdraw consent in Settings.",
        },
        {
          heading: "Where data lives",
          body: "Data is stored on the app's server. The database is backed up daily.",
        },
        {
          heading: "Your rights",
          body: "You can access, correct, delete and export your data and withdraw consent. Account deletion is in Settings.",
        },
      ],
    },
  },
};
