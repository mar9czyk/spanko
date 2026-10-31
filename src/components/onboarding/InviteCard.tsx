"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { pb, regenerateHouseholdInviteCode } from "@/lib/pocketbase";
import type { HouseholdRecord } from "@/lib/types/database";

/**
 * Karta z kodem zaproszenia drugiego rodzica: kod, ważność, kopiowanie, udostępnianie i nowy kod.
 *
 * @param {object} props - Identyfikator rodziny użytkownika
 * @returns {ReactNode} Karta zaproszenia
 */
export function InviteCard({ householdId }: { readonly householdId: string }): ReactNode {
  const { t } = useI18n();
  const [household, setHousehold] = useState<HouseholdRecord | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setHousehold(await pb.collection("households").getOne<HouseholdRecord>(householdId));
  }, [householdId]);

  useEffect(() => {
    load().catch(() => setNotice(t("onb.invite.loadError")));
  }, [load, t]);

  const code = household?.invite_code ?? "";
  const expiresAt = household?.invite_expires_at ? new Date(household.invite_expires_at) : null;
  const isActive = Boolean(code) && expiresAt !== null && expiresAt.getTime() > Date.now();
  const link = isActive ? `${window.location.origin}/join/${code}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setNotice(t("onb.invite.copied"));
    } catch {
      setNotice(code);
    }
  };

  const share = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Spanko", text: t("onb.invite.shareText"), url: link });
        return;
      } catch {
        // Anulowano udostępnianie — kopiujemy link.
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setNotice(t("onb.invite.linkCopied"));
    } catch {
      setNotice(link);
    }
  };

  const regenerate = async () => {
    setHousehold(await regenerateHouseholdInviteCode(householdId));
    setNotice(null);
  };

  const button =
    "h-11 flex-1 rounded-xl border border-white/10 text-sm text-slate-200 active:scale-[0.98] transition disabled:opacity-40";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-center font-mono text-4xl tracking-[0.3em] text-amber-200">
        {isActive ? code : "——————"}
      </p>
      <p className="text-center text-xs text-slate-400">
        {isActive && expiresAt
          ? t("onb.invite.validUntil", { date: expiresAt.toLocaleString() })
          : t("onb.invite.expired")}
      </p>
      <div className="flex gap-2">
        <button type="button" className={button} disabled={!isActive} onClick={copy}>
          {t("onb.invite.copy")}
        </button>
        <button type="button" className={button} disabled={!isActive} onClick={share}>
          {t("onb.invite.share")}
        </button>
      </div>
      <button type="button" className={button} onClick={regenerate}>
        {t("onb.invite.regenerate")}
      </button>
      {notice && (
        <p role="status" className="text-center text-xs text-slate-400">
          {notice}
        </p>
      )}
    </div>
  );
}
