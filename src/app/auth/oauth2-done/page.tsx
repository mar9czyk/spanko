"use client";

import { type ReactNode, useEffect } from "react";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * Koniec logowania Google w oknie popup: zamyka okno samo.
 *
 * @description
 * PocketBase kończy OAuth2 przekierowaniem na `/_/#/auth/oauth2-redirect-success`, a panel `/pb/_/*`
 * jest publicznie zablokowany, więc Caddy kieruje dokładnie `/pb/_/` tutaj. Zamknięcie z okna
 * aplikacji (`popup.close()` w SDK) nie działa po przejściu przez strony Google.
 *
 * @returns {ReactNode} Komunikat widoczny, gdy przeglądarka nie pozwoli zamknąć okna
 */
export default function OAuth2DonePage(): ReactNode {
  const { t } = useI18n();

  useEffect(() => {
    window.close();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B0F17] p-6 text-center text-sm text-slate-300">
      {t("login.oauthDone")}
    </main>
  );
}
