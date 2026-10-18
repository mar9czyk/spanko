import type { InsightEvaluationContext } from "@/lib/openrouter";
import type { SandboxSample } from "@/lib/sandboxSamples";
import {
  calculateChronicDrive,
  type DailySleepSummary,
  type DiagnosticEvaluationInput,
  evaluateAll7DiagnosticCategories,
  getAgeBracket,
} from "@/lib/sleep-engine";

const SAMPLE_DAYS = 14;
const DEFAULT_BEDTIME_MINUTES = 1200;
const MS_PER_DAY = 86_400_000;

interface SampleSpec {
  readonly ageDays: number;
  readonly dailyTotalMin: number;
  readonly label: string;
}

const SAMPLE_SPECS: Record<SandboxSample, SampleSpec> = {
  balanced: { ageDays: 150, dailyTotalMin: 840, label: "5 msc" },
  sleep_debt: { ageDays: 150, dailyTotalMin: 690, label: "5 msc" },
  newborn: { ageDays: 40, dailyTotalMin: 930, label: "6 tyg." },
};

/**
 * Buduje deterministyczne dane przykładowe dla Sandboxa admina (bez dostępu do danych rodzin).
 *
 * @param {SandboxSample} sample - Wariant przykładowych danych
 * @returns {InsightEvaluationContext} Kontekst wyliczony przez silnik snu
 */
export function buildSandboxContext(sample: SandboxSample): InsightEvaluationContext {
  const spec = SAMPLE_SPECS[sample];
  const nowMs = Date.now();
  const birthDateIso = new Date(nowMs - spec.ageDays * MS_PER_DAY).toISOString();
  const dailyTotals: DailySleepSummary[] = Array.from({ length: SAMPLE_DAYS }, (_, index) => ({
    physiologicalDate: new Date(nowMs - (index + 1) * MS_PER_DAY).toISOString().slice(0, 10),
    totalSleepMin: spec.dailyTotalMin,
    isIllOrIgnored: false,
  }));

  const bracket = getAgeBracket(spec.ageDays);
  const chronicDrive = calculateChronicDrive(dailyTotals, bracket);

  const input: DiagnosticEvaluationInput = {
    child: { birthDateIso, dueDateIso: null, activeDayMode: "home" },
    todayContext: { dayMode: "home" },
    recentSleepLogs: [],
    dailyTotalsLast14DaysMin: dailyTotals,
    currentMetrics: {
      effectiveAgeDays: spec.ageDays,
      chronicSleepDebtMin: chronicDrive.chronicSleepDebtMin,
      sleepBatteryPercent: chronicDrive.sleepBatteryPercent,
      sleepNeedsProfile: chronicDrive.sleepNeedsProfile,
      biologicalBedtimeMinFromMidnight: DEFAULT_BEDTIME_MINUTES,
    },
  };

  const triggered = evaluateAll7DiagnosticCategories(input).filter((diag) => diag.isTriggered);
  return {
    childAgeDisplay: spec.label,
    effectiveAgeDays: spec.ageDays,
    activeDayMode: "home",
    chronicSleepDebtMin: chronicDrive.chronicSleepDebtMin,
    sleepBatteryPercent: chronicDrive.sleepBatteryPercent,
    sleepNeedsProfile: chronicDrive.sleepNeedsProfile,
    triggeredDiagnostics: triggered.map((diag) => ({
      category: diag.category,
      diagnosisCode: diag.diagnosisCode,
      severity: diag.severity,
      title: diag.title,
      explanation: diag.explanation,
      clinicalAction: diag.clinicalAction,
    })),
    activeInsights: [],
  };
}
