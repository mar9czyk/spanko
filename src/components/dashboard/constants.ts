import type { MessageKey } from "@/i18n/messages";
import type { ActiveDayMode, InterventionLevel, SleepMood } from "@/lib/types/database";

export const REM_COUNTDOWN_SECONDS = 60;
export const NEWBORN_THRESHOLD_DAYS = 112; // 16 tygodni
export const FALLBACK_LAST_NAP_CAPPING = "16:45";

export interface DayModeConfigItem {
  readonly mode: ActiveDayMode;
  readonly labelKey: MessageKey;
  readonly descKey: MessageKey;
  readonly icon: string;
}

export const DAY_MODE_OPTIONS: readonly DayModeConfigItem[] = [
  { mode: "home", labelKey: "dayMode.home.label", descKey: "dayMode.home.desc", icon: "🏠" },
  {
    mode: "on_the_go",
    labelKey: "dayMode.on_the_go.label",
    descKey: "dayMode.on_the_go.desc",
    icon: "🚗",
  },
  {
    mode: "illness_regression",
    labelKey: "dayMode.illness_regression.label",
    descKey: "dayMode.illness_regression.desc",
    icon: "🤒",
  },
] as const;

export interface MoodOptionItem {
  readonly value: SleepMood;
  readonly labelKey: MessageKey;
  readonly colorClass: string;
}

export const MOOD_OPTIONS: readonly MoodOptionItem[] = [
  { value: "easy", labelKey: "mood.easy", colorClass: "text-emerald-400 border-emerald-500/30" },
  { value: "fussy", labelKey: "mood.fussy", colorClass: "text-amber-400 border-amber-500/30" },
  { value: "crying", labelKey: "mood.crying", colorClass: "text-rose-400 border-rose-500/30" },
] as const;

export interface InterventionOptionItem {
  readonly value: InterventionLevel;
  readonly labelKey: MessageKey;
}

export const INTERVENTION_OPTIONS: readonly InterventionOptionItem[] = [
  { value: "independent", labelKey: "intervention.independent" },
  { value: "pacifier_reinsert", labelKey: "intervention.pacifier_reinsert" },
  { value: "patting", labelKey: "intervention.patting" },
  { value: "carrying", labelKey: "intervention.carrying" },
  { value: "bouncing", labelKey: "intervention.bouncing" },
  { value: "breast", labelKey: "intervention.breast" },
  { value: "bottle", labelKey: "intervention.bottle" },
  { value: "shushing_voice", labelKey: "intervention.shushing_voice" },
  { value: "room_presence", labelKey: "intervention.room_presence" },
] as const;

export const QUICK_WAKE_DURATION_OPTIONS = [
  { minutes: 5, label: "5 min" },
  { minutes: 15, label: "15 min" },
  { minutes: 60, label: "1h+" },
] as const;

export const DAY_TAG_PRESETS = [
  "ząbkowanie",
  "spacer",
  "skok_rozwojowy",
  "gorączka",
  "szczepienie",
  "podróż",
  "światło_dzienne",
  "goście",
] as const;

export const DEFAULT_BOTTLE_ML = 120;

export const BREAST_DURATION_PRESETS_MIN = [5, 10, 15, 20] as const;

export const DIAPER_OPTIONS = [
  { value: "wet", labelKey: "diaper.wet" },
  { value: "dirty", labelKey: "diaper.dirty" },
  { value: "both", labelKey: "diaper.both" },
] as const satisfies readonly { value: string; labelKey: MessageKey }[];
