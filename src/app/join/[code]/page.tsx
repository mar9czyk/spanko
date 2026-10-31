"use client";

import { useParams, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { storePendingInvite } from "@/lib/onboarding";

/**
 * Wejście z linku zaproszenia: zapamiętuje kod i kieruje do aplikacji; bramka sesji przeprowadzi
 * przez logowanie i zgody do ekranu dołączania.
 *
 * @returns {ReactNode} Komunikat ładowania
 */
export default function JoinLinkPage(): ReactNode {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    if (params.code) storePendingInvite(decodeURIComponent(params.code));
    router.replace("/dashboard");
  }, [params.code, router]);

  return <p className="p-10 text-center text-sm text-slate-400">{t("common.loading")}</p>;
}
