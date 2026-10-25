import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * Zawartość zakładki „Ostatnia drzemka”: duża godzina i jedno zdanie, po co ten limit.
 *
 * @param {object} props - Godzina końca ostatniej drzemki (HH:mm) i powód aktualnej pory SweetSpot
 * @returns {ReactNode} Wyrenderowana zawartość
 */
export function LastNapPanel({ time, reason }: { time: string; reason: string }): ReactNode {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-semibold text-amber-400/90 uppercase tracking-wider">
        {t("bubble.nap")}
      </span>
      <span className="text-5xl font-extrabold text-ink tabular-nums tracking-tight">
        {t("bubble.nap.big", { time })}
      </span>
      <p className="text-base text-slate-300">{t("bubble.nap.why")}</p>
      {reason && <p className="text-sm text-amber-200">{reason}</p>}
    </div>
  );
}
