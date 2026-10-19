/**
 * Definicje typów domenowych dla deterministycznego silnika snu Spanko.
 *
 * @description
 * Moduł zawiera interfejsy i unie typów opisujące stany snu, interwencje usypiania,
 * matrycę wiekową, parametry 3 napędów snu oraz wyniki 7 drzew diagnostycznych.
 */

export type SleepType = "nap" | "night";

export type SleepStatus = "falling_asleep" | "sleeping" | "completed";

export type SleepMood = "easy" | "fussy" | "crying";

export type InterventionType =
  | "breast"
  | "bottle"
  | "bouncing"
  | "carrying"
  | "stroller_car"
  | "co_sleeping"
  | "patting"
  | "pacifier_reinsert"
  | "shushing_voice"
  | "room_presence"
  | "independent";

export type DayMode = "home" | "on_the_go" | "illness_regression";

export type ProblemCategory =
  | "CAT1_ASSOCIATIONS_NIGHT_WAKINGS"
  | "CAT2_BEDTIME_RESISTANCE_LATENCY"
  | "CAT3_EARLY_WAKING_SPLIT_NIGHT"
  | "CAT4_SHORT_NAPS_TRANSITIONS"
  | "CAT5_REGRESSION_ILLNESS_CRISIS"
  | "CAT6_NEWBORN_DAY_NIGHT_ACTIVE_SLEEP"
  | "CAT7_NIGHT_WEANING_FEEDING";

export type InsightStatus =
  | "hypothesis"
  | "active"
  | "validated"
  | "corrected_by_parent"
  | "superseded";

export type SleepNeedsProfile = "low_sleep_needs" | "average" | "high_sleep_needs";

/** Słowny stan wyspania dziecka wyprowadzony z chronicznego długu sennego. */
export type SleepRestednessLevel = "rested" | "slightly_tired" | "very_tired";

export type DiagnosticSeverity = "low" | "medium" | "high" | "info";

export interface NightWakingEntry {
  readonly wokeAt: string;
  readonly fellAsleepAt?: string;
  readonly estimatedDurationMin: number;
  readonly fedMilk: boolean;
  readonly interventions: readonly InterventionType[];
}

export interface SleepLog {
  readonly id: string;
  readonly childId: string;
  readonly physiologicalDate: string;
  readonly type: SleepType;
  readonly status: SleepStatus;
  readonly putDownAt: string;
  readonly fellAsleepAt: string;
  readonly wokeUpAt?: string;
  readonly interventions: readonly InterventionType[];
  /** Nastrój przy usypianiu; brak = nie zapisano (to nie to samo co „spokojnie”). */
  readonly mood?: SleepMood;
  readonly nightWakings: readonly NightWakingEntry[];
  readonly isReboundSleep?: boolean;
  readonly ignoreInCalibration?: boolean;
}

export interface AgeBracketConfig {
  readonly minAgeDays: number;
  readonly maxAgeDays: number;
  readonly targetNapsCount: number;
  readonly wwMinMorning: number;
  readonly wwMaxEvening: number;
  readonly maxSingleNapMin: number;
  readonly maxDaytimeSleepMin: number;
  readonly medianTotalSleepMin: number;
  readonly homeostaticTauRiseMin: number;
  /**
   * Najmniejsza liczba drzemek, która w tym wieku jest jeszcze normą (zakres minNapsCount–targetNapsCount).
   * Brak = tylko targetNapsCount. Silnik schodzi do tej liczby, gdy dziecko samo tak śpi (≥5 z 7 dób).
   */
  readonly minNapsCount?: number;
  /** Średnia liczba pobudek nocnych w tym wieku (kontekst dla CAT1, nie próg diagnozy). */
  readonly nightWakingsMean?: number;
  /** Górna granica normy pobudek nocnych w tym wieku. */
  readonly nightWakingsUpperNorm?: number;
}

export interface DailySleepSummary {
  readonly physiologicalDate: string;
  readonly totalSleepMin: number;
  readonly isIllOrIgnored: boolean;
  readonly daytimeSleepMin?: number;
  readonly nightSleepMin?: number;
  /** Liczba zakończonych drzemek w dobie. */
  readonly napCount?: number;
  /** Najdłuższa drzemka doby w minutach. */
  readonly longestNapMin?: number;
  /** Rodzic oznaczył sen w tej dobie jako odsypianie (rebound). */
  readonly isRebound?: boolean;
}

export interface ChronicDriveResult {
  readonly individualSleepNeedMin: number;
  readonly chronicSleepDebtMin: number;
  readonly sleepBatteryPercent: number;
  readonly sleepNeedsProfile: SleepNeedsProfile;
}

export interface CircadianCalculationParams {
  readonly morningWakeTimesLast5DaysMinutesFromMidnight: readonly number[];
  readonly bracket: AgeBracketConfig;
  /** Faktyczne pory zaśnięcia na noc z ostatnich 5 dób (minuty od północy, czas lokalny). */
  readonly bedtimesLast5DaysMinutesFromMidnight?: readonly number[];
  /** Przesunięcie pory nocnej z drzewa (bedtime fading), w minutach; + = później. */
  readonly bedtimeShiftMin?: number;
  /** Korekta limitu snu dziennego z drzewa (nap capping), w minutach; − = krócej. */
  readonly daytimeSleepCapOffsetMin?: number;
}

export interface CircadianParametersResult {
  readonly circadianAnchorWakeTime: string;
  readonly biologicalBedtime: string;
  readonly forbiddenZoneStart: string;
  readonly forbiddenZoneEnd: string;
  readonly latestLastNapEndAt: string;
  /** Przewidywana pora snu nocnego w minutach od północy (nazwa pola historyczna). */
  readonly biologicalBedtimeMinFromMidnight: number;
}

export interface NextSleepSlotParams {
  readonly lastWakeUpIso: string;
  readonly previousNapDurationMin: number | null;
  readonly napIndexToday: number;
  readonly effectiveAgeDays: number;
  readonly bracket: AgeBracketConfig;
  readonly chronicSleepDebtMin: number;
  readonly dayMode: DayMode;
  readonly insightWwOffsetMin: number;
  readonly biologicalBedtimeMinFromMidnight: number;
  /** Strefa IANA dziecka, w której liczone są godziny (WMZ, kotwica poranna). */
  readonly timeZone: string;
}

export interface NextSleepSlotPrediction {
  readonly sweetSpotIso: string;
  readonly compassWindowStartIso: string;
  readonly compassWindowEndIso: string;
  readonly targetWakeWindowMin: number;
  readonly reasonCode: string;
}

export interface ThreeDrivesSummary {
  readonly effectiveAgeDays: number;
  readonly acuteSleepPressure: number;
  readonly chronicSleepDebtMin: number;
  readonly sleepBatteryPercent: number;
  readonly individualSleepNeedMin: number;
  readonly sleepNeedsProfile: SleepNeedsProfile;
  readonly circadianAnchorWakeTime: string;
  readonly biologicalBedtime: string;
  readonly forbiddenZoneStart: string;
  readonly forbiddenZoneEnd: string;
  readonly latestLastNapEndAt: string;
}

export interface DiagnosticAlgorithmOverride {
  readonly wakeWindowOffsetMinutes?: number;
  readonly bedtimeFadingMinutes?: number;
  readonly recommendedDayMode?: DayMode;
  readonly maxDaytimeSleepCapMinutes?: number;
  /** Co ile dni powtarzać przesunięcie (bedtime fading, przesuwanie rytmu lub drzemki). */
  readonly shiftEveryDays?: number;
}

export interface DiagnosticTreeResult {
  readonly category: ProblemCategory;
  readonly diagnosisCode: string;
  readonly severity: DiagnosticSeverity;
  readonly confidenceScore: number;
  readonly isTriggered: boolean;
  readonly title: string;
  readonly explanation: string;
  readonly clinicalAction: string;
  readonly algorithmOverride?: DiagnosticAlgorithmOverride;
}

export interface ChildEvaluationContext {
  readonly birthDateIso: string;
  readonly dueDateIso?: string | null;
  readonly activeDayMode: DayMode;
  readonly currentPlanStartDateIso?: string | null;
}

export interface DayEvaluationContext {
  readonly tags?: readonly string[];
  readonly dayMode?: DayMode;
}

export interface CurrentMetricsContext {
  readonly effectiveAgeDays: number;
  readonly chronicSleepDebtMin: number;
  readonly sleepBatteryPercent: number;
  readonly sleepNeedsProfile: SleepNeedsProfile;
  readonly biologicalBedtimeMinFromMidnight: number;
}

export interface DiagnosticEvaluationInput {
  /** Czas odniesienia — drzewa nie czytają zegara systemowego. */
  readonly nowIso: string;
  /** Strefa IANA dziecka, w której liczone są godziny pobudek. */
  readonly timeZone: string;
  readonly child: ChildEvaluationContext;
  readonly todayContext?: DayEvaluationContext;
  readonly recentSleepLogs: readonly SleepLog[];
  readonly dailyTotalsLast14DaysMin: readonly DailySleepSummary[];
  readonly currentMetrics: CurrentMetricsContext;
}
