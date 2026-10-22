"use client";

import { Globe } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import {
  EAST_SHIFT_STEP_MINUTES,
  getTimeZoneDifferenceMinutes,
  recommendTravelStrategy,
  resolveAdaptationDays,
  type ScheduleClock,
  type TravelPlan,
  type TravelStrategy,
  WEST_SHIFT_STEP_MINUTES,
} from "@/lib/sleep-engine";

const DISMISS_STORAGE_KEY = "spanko.travelPromptDismissedZone";
const STRATEGIES: readonly TravelStrategy[] = ["stay_home", "gradual", "local_now"];

interface TravelTimeZoneCardProps {
  readonly childTimeZone: string;
  readonly plan: TravelPlan | null | undefined;
  readonly clock: ScheduleClock;
  readonly isOnTheGo: boolean;
  readonly nowIso: string;
  readonly onApply: (toTimeZone: string, strategy: TravelStrategy) => void;
  readonly onFinishAdaptation: () => void;
}

/**
 * Strefa urządzenia (tylko po stronie klienta).
 *
 * @returns {string | null} Strefa IANA albo null przed zamontowaniem
 */
function useDeviceTimeZone(): string | null {
  const [zone, setZone] = useState<string | null>(null);
  useEffect(() => setZone(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  return zone;
}

/**
 * Lista stref IANA z przeglądarki (pusta, gdy brak wsparcia).
 *
 * @returns {readonly string[]} Strefy
 */
function listTimeZones(): readonly string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  return intl.supportedValuesOf?.("timeZone") ?? [];
}

/**
 * Czytelna nazwa strefy: ostatni człon IANA bez podkreśleń.
 *
 * @param {string} zone - Strefa IANA
 * @returns {string} Nazwa, np. „New York”
 */
function zoneLabel(zone: string): string {
  return (zone.split("/").pop() ?? zone).replaceAll("_", " ");
}

/**
 * Różnica stref jako „+7 h” albo „−5,5 h”.
 *
 * @param {number} diffMin - Różnica w minutach
 * @param {string} locale - Język
 * @returns {string} Tekst różnicy
 */
function formatDiff(diffMin: number, locale: string): string {
  const hours = Math.abs(diffMin) / 60;
  return `${diffMin >= 0 ? "+" : "−"}${hours.toLocaleString(locale)} h`;
}

/**
 * Wybór strategii snu po zmianie strefy oraz stan stopniowego przestawiania.
 *
 * @description
 * Pojawia się sam, gdy strefa telefonu różni się od strefy dziecka, a w trybie „W drodze”
 * jest dostępny ręcznie. Strategię zaleca silnik (`recommendTravelStrategy`), wybór należy do rodzica.
 *
 * @param {TravelTimeZoneCardProps} props - Strefa dziecka, plan, zegar i akcje
 * @returns {ReactNode} Karta albo nic
 */
export function TravelTimeZoneCard({
  childTimeZone,
  plan,
  clock,
  isOnTheGo,
  nowIso,
  onApply,
  onFinishAdaptation,
}: TravelTimeZoneCardProps): ReactNode {
  const { t, tDynamic, locale } = useI18n();
  const deviceZone = useDeviceTimeZone();
  const [dismissedZone, setDismissedZone] = useState<string | null>(null);
  const [manualZone, setManualZone] = useState<string | null>(null);
  const [isShortTrip, setIsShortTrip] = useState(false);

  useEffect(() => {
    try {
      setDismissedZone(window.localStorage.getItem(DISMISS_STORAGE_KEY));
    } catch {
      setDismissedZone(null);
    }
  }, []);

  if (clock.isAdapting) {
    return (
      <section className="rounded-2xl bg-[#151B28] border border-violet-500/30 p-3.5 flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-violet-200">
          <Globe className="w-4 h-4" /> {t("travel.title")}
        </h2>
        <p className="text-sm text-ink">
          {t("travel.adapting", { day: clock.adaptationDay, days: clock.adaptationDays })}
        </p>
        <p className="text-xs text-slate-400">{t("travel.adaptingHint")}</p>
        <button
          type="button"
          onClick={onFinishAdaptation}
          className="min-h-12 rounded-xl bg-[#1E2738] text-sm font-semibold text-violet-200"
        >
          {t("travel.finish")}
        </button>
      </section>
    );
  }

  const isPromptZone =
    deviceZone !== null &&
    getTimeZoneDifferenceMinutes(childTimeZone, deviceZone, nowIso) !== 0 &&
    !(plan?.strategy === "stay_home" && plan.toTimeZone === deviceZone) &&
    dismissedZone !== deviceZone;
  if (!isPromptZone && !isOnTheGo) return null;

  const targetZone = manualZone ?? (isPromptZone ? deviceZone : null) ?? childTimeZone;
  const diff = getTimeZoneDifferenceMinutes(childTimeZone, targetZone, nowIso);
  const recommended = recommendTravelStrategy(diff, isShortTrip);
  const step = diff > 0 ? EAST_SHIFT_STEP_MINUTES : WEST_SHIFT_STEP_MINUTES;
  const zones = listTimeZones();

  const dismiss = () => {
    if (!deviceZone) return;
    setDismissedZone(deviceZone);
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, deviceZone);
    } catch {
      // Brak pamięci przeglądarki: baner wróci po odświeżeniu
    }
  };

  const chooser = (
    <div className="flex flex-col gap-2.5">
      {zones.length > 0 && (
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {t("travel.zoneLabel")}
          <select
            value={targetZone}
            onChange={(event) => setManualZone(event.target.value)}
            className="min-h-12 rounded-xl bg-[#1E2738] px-3 text-sm text-ink"
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      )}
      {diff === 0 ? (
        <p className="text-sm text-slate-300">{t("travel.sameZone")}</p>
      ) : (
        <>
          <p className="text-sm text-slate-300">
            {t("travel.diff", { diff: formatDiff(diff, locale) })}
          </p>
          <div className="flex gap-2">
            {[true, false].map((short) => (
              <button
                key={String(short)}
                type="button"
                aria-pressed={isShortTrip === short}
                onClick={() => setIsShortTrip(short)}
                className={`min-h-12 flex-1 rounded-xl text-sm ${
                  isShortTrip === short
                    ? "bg-violet-500/20 text-violet-100 font-semibold"
                    : "bg-[#1E2738] text-slate-300"
                }`}
              >
                {short ? t("travel.tripShort") : t("travel.tripLong")}
              </button>
            ))}
          </div>
          {STRATEGIES.map((strategy) => (
            <button
              key={strategy}
              type="button"
              onClick={() => onApply(targetZone, strategy)}
              className={`min-h-12 rounded-xl p-3 text-left flex flex-col gap-0.5 ${
                strategy === recommended
                  ? "bg-violet-500/15 border border-violet-400/50"
                  : "bg-[#1E2738]"
              }`}
            >
              <span className="text-sm font-semibold text-ink">
                {tDynamic(`travel.${strategy}.title`, strategy)}
                {strategy === recommended && (
                  <span className="ml-2 text-xs font-normal text-violet-200">
                    {t("travel.recommended")}
                  </span>
                )}
              </span>
              <span className="text-xs text-slate-300">
                {strategy === "gradual"
                  ? t("travel.gradual.desc", { step, days: resolveAdaptationDays(diff) })
                  : tDynamic(`travel.${strategy}.desc`, "")}
              </span>
            </button>
          ))}
          <p className="text-xs text-slate-400">{t("travel.tip")}</p>
        </>
      )}
    </div>
  );

  if (isPromptZone && deviceZone) {
    return (
      <section className="rounded-2xl bg-[#151B28] border border-violet-500/30 p-3.5 flex flex-col gap-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-violet-200">
          <Globe className="w-4 h-4" /> {t("travel.title")}
        </h2>
        <p className="text-sm text-ink">
          {t("travel.prompt", {
            zone: zoneLabel(deviceZone),
            diff: formatDiff(
              getTimeZoneDifferenceMinutes(childTimeZone, deviceZone, nowIso),
              locale,
            ),
          })}
        </p>
        {chooser}
        <button type="button" onClick={dismiss} className="min-h-12 text-sm text-slate-400">
          {t("travel.dismiss")}
        </button>
      </section>
    );
  }

  return (
    <details className="group rounded-2xl bg-[#151B28] border border-violet-500/20 px-3.5">
      <summary className="cursor-pointer list-none min-h-12 flex items-center gap-2 text-sm font-semibold text-violet-200">
        <Globe className="w-4 h-4" /> {t("travel.title")}
      </summary>
      <div className="pb-3.5">{chooser}</div>
    </details>
  );
}
