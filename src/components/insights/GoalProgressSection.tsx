"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { GOAL_TITLES, localize, METHOD_TITLES } from "@/lib/goal-copy";
import type { GoalProgressPoint } from "@/lib/goals-engine/progress";
import type { ChildRecord } from "@/lib/types/database";
import { useGoalProgress } from "./useGoalProgress";

const CHART_WIDTH = 320;
const CHART_HEIGHT = 140;
const PAD = { left: 28, right: 8, top: 10, bottom: 22 } as const;
const HEADROOM = 1.15;
const DECIMALS = 1;

interface ChartGeometry {
  readonly x: (index: number) => number;
  readonly y: (value: number) => number;
  readonly yMax: number;
}

/**
 * Buduje skale wykresu; oś Y zaczyna się od 0, a góra obejmuje baseline, cel i wszystkie pomiary.
 *
 * @param {readonly GoalProgressPoint[]} points - Punkty serii
 * @param {readonly number[]} references - Wartości odniesienia (baseline, cel)
 * @returns {ChartGeometry} Funkcje przeliczające indeks i wartość na współrzędne SVG
 */
function buildGeometry(
  points: readonly GoalProgressPoint[],
  references: readonly number[],
): ChartGeometry {
  const values = points.flatMap((p) => (p.value === null ? [] : [p.value]));
  const yMax = Math.max(1, Math.ceil(Math.max(...values, ...references) * HEADROOM));
  const innerW = CHART_WIDTH - PAD.left - PAD.right;
  const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const lastIndex = Math.max(1, points.length - 1);
  return {
    yMax,
    x: (index) => PAD.left + (index / lastIndex) * innerW,
    y: (value) => PAD.top + innerH - (value / yMax) * innerH,
  };
}

/**
 * Dzieli serię na odcinki ciągłych pomiarów (doby bez pomiaru przerywają linię).
 *
 * @param {readonly GoalProgressPoint[]} points - Punkty serii
 * @returns {Array<Array<{ index: number; value: number }>>} Odcinki linii
 */
function toSegments(
  points: readonly GoalProgressPoint[],
): Array<Array<{ index: number; value: number }>> {
  const segments: Array<Array<{ index: number; value: number }>> = [];
  let current: Array<{ index: number; value: number }> = [];
  points.forEach((point, index) => {
    if (point.value === null) {
      if (current.length > 0) segments.push(current);
      current = [];
    } else {
      current.push({ index, value: point.value });
    }
  });
  if (current.length > 0) segments.push(current);
  return segments;
}

function formatValue(value: number): string {
  return String(Number(value.toFixed(DECIMALS)));
}

/**
 * Sekcja „Postęp celu” w /insights: wykres metryki celu względem baseline i wartości docelowej
 * oraz lista wcześniejszych celów.
 *
 * @param {{ child: ChildRecord | null }} props - Aktywne dziecko
 * @returns {ReactNode} Karta z wykresem albo podpowiedź, gdy dziecko nie miało jeszcze celu
 */
export function GoalProgressSection({ child }: { readonly child: ChildRecord | null }): ReactNode {
  const { t, locale } = useI18n();
  const { status, data } = useGoalProgress(child?.id);
  if (!child || status === "loading") return null;

  const heading = <h2 className="text-sm font-semibold text-ink">{t("goalProgress.title")}</h2>;

  if (status === "error") {
    return (
      <section className="rounded-2xl bg-[#151B28] border border-slate-800 p-3.5 flex flex-col gap-2">
        {heading}
        <p className="text-xs text-slate-400">{t("goalProgress.error")}</p>
      </section>
    );
  }
  if (!data?.featured || !data.series) {
    return (
      <section className="rounded-2xl bg-[#151B28] border border-slate-800 p-3.5 flex flex-col gap-2">
        {heading}
        <p className="text-xs text-slate-400">{t("goalProgress.empty")}</p>
      </section>
    );
  }

  const { featured, series, goals } = data;
  const metricLabel = t(`goalProgress.metric.${featured.goal_type}`);
  const measured = series.points.filter((p) => p.value !== null);
  const latest = measured[measured.length - 1]?.value ?? null;
  const geometry = buildGeometry(
    series.points,
    series.baseline === null ? [series.target] : [series.baseline, series.target],
  );
  const pastGoals = goals.filter((g) => g.id !== featured.id);

  return (
    <section className="rounded-2xl bg-[#151B28] border border-amber-500/20 p-3.5 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        {heading}
        <span className="text-xs text-amber-300">
          {localize(GOAL_TITLES[featured.goal_type], locale)} ·{" "}
          {t(`goalProgress.status.${featured.status}`)}
        </span>
      </div>
      <p className="text-xs text-slate-400">
        {t("goalProgress.legend", { metric: metricLabel })} ·{" "}
        {localize(METHOD_TITLES[featured.method], locale)}
      </p>

      {measured.length < 2 ? (
        <p className="text-xs text-slate-400">{t("goalProgress.noData")}</p>
      ) : (
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-label={t("goalProgress.summary", {
            metric: metricLabel,
            baseline: series.baseline === null ? "–" : formatValue(series.baseline),
            target: formatValue(series.target),
            latest: latest === null ? "–" : formatValue(latest),
          })}
          className="w-full h-auto"
        >
          <title>{t("goalProgress.title")}</title>
          <line
            x1={PAD.left}
            x2={CHART_WIDTH - PAD.right}
            y1={geometry.y(0)}
            y2={geometry.y(0)}
            className="stroke-slate-700"
          />
          <text
            x={PAD.left - 4}
            y={geometry.y(0) + 3}
            textAnchor="end"
            className="fill-slate-500 text-[9px]"
          >
            0
          </text>
          <text
            x={PAD.left - 4}
            y={geometry.y(geometry.yMax) + 3}
            textAnchor="end"
            className="fill-slate-500 text-[9px]"
          >
            {geometry.yMax}
          </text>
          {series.baseline !== null && (
            <>
              <line
                x1={PAD.left}
                x2={CHART_WIDTH - PAD.right}
                y1={geometry.y(series.baseline)}
                y2={geometry.y(series.baseline)}
                strokeDasharray="4 3"
                className="stroke-slate-500"
              />
              <text
                x={CHART_WIDTH - PAD.right}
                y={geometry.y(series.baseline) - 3}
                textAnchor="end"
                className="fill-slate-400 text-[9px]"
              >
                {t("goalProgress.baseline", { value: formatValue(series.baseline) })}
              </text>
            </>
          )}
          <line
            x1={PAD.left}
            x2={CHART_WIDTH - PAD.right}
            y1={geometry.y(series.target)}
            y2={geometry.y(series.target)}
            strokeDasharray="4 3"
            className="stroke-emerald-500/70"
          />
          <text
            x={CHART_WIDTH - PAD.right}
            y={geometry.y(series.target) - 3}
            textAnchor="end"
            className="fill-emerald-400 text-[9px]"
          >
            {t("goalProgress.target", { value: formatValue(series.target) })}
          </text>
          {toSegments(series.points).map((segment) => (
            <polyline
              key={`seg-${segment[0]?.index}`}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              className="stroke-amber-400"
              points={segment.map((p) => `${geometry.x(p.index)},${geometry.y(p.value)}`).join(" ")}
            />
          ))}
          {series.points.map((point, index) =>
            point.value === null ? null : (
              <circle
                key={point.date}
                cx={geometry.x(index)}
                cy={geometry.y(point.value)}
                r={3}
                className="fill-amber-400"
              />
            ),
          )}
          <text x={PAD.left} y={CHART_HEIGHT - 6} className="fill-slate-500 text-[9px]">
            {series.points[0]?.date.slice(5)}
          </text>
          <text
            x={CHART_WIDTH - PAD.right}
            y={CHART_HEIGHT - 6}
            textAnchor="end"
            className="fill-slate-500 text-[9px]"
          >
            {series.points[series.points.length - 1]?.date.slice(5)}
          </text>
        </svg>
      )}
      <p className="text-xs text-slate-500">{t("goalProgress.illnessNote")}</p>

      {pastGoals.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-slate-800 pt-2">
          <h3 className="text-xs font-semibold text-slate-300">{t("goalProgress.history")}</h3>
          <ul className="flex flex-col gap-1 text-xs text-slate-400">
            {pastGoals.map((goal) => (
              <li key={goal.id} className="flex justify-between gap-2">
                <span>
                  {localize(GOAL_TITLES[goal.goal_type], locale)} · {goal.started_on}
                </span>
                <span>{t(`goalProgress.status.${goal.status}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
