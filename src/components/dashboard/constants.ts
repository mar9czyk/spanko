import type { ActiveDayMode, InterventionLevel, SleepMood } from "@/lib/types/database";

export const REM_COUNTDOWN_SECONDS = 60;
export const NEWBORN_THRESHOLD_DAYS = 112; // 16 tygodni
export const FALLBACK_LAST_NAP_CAPPING = "16:45";

export interface DayModeConfigItem {
  readonly mode: ActiveDayMode;
  readonly label: string;
  readonly icon: string;
  readonly description: string;
}

export const DAY_MODE_OPTIONS: readonly DayModeConfigItem[] = [
  { mode: "home", label: "W domu", icon: "🏠", description: "Standardowy harmonogram domowy" },
  { mode: "on_the_go", label: "W drodze", icon: "🚗", description: "Drzemki w wózku lub foteliku" },
  {
    mode: "illness_regression",
    label: "Choroba",
    icon: "🤒",
    description: "Skrócone okna i ochrona snu",
  },
] as const;

export interface MoodOptionItem {
  readonly value: SleepMood;
  readonly label: string;
  readonly colorClass: string;
}

export const MOOD_OPTIONS: readonly MoodOptionItem[] = [
  { value: "easy", label: "🟢 Gładko", colorClass: "text-emerald-400 border-emerald-500/30" },
  { value: "fussy", label: "🟡 Marudzenie", colorClass: "text-amber-400 border-amber-500/30" },
  { value: "crying", label: "🔴 Płacz", colorClass: "text-rose-400 border-rose-500/30" },
] as const;

export interface InterventionOptionItem {
  readonly value: InterventionLevel;
  readonly label: string;
}

export const INTERVENTION_OPTIONS: readonly InterventionOptionItem[] = [
  { value: "independent", label: "Samodzielnie" },
  { value: "pacifier_reinsert", label: "Smoczek" },
  { value: "patting", label: "Głaskanie" },
  { value: "carrying", label: "Noszenie" },
  { value: "bouncing", label: "Bujanie" },
  { value: "breast", label: "Pierś" },
  { value: "bottle", label: "Butelka" },
  { value: "shushing_voice", label: "Szum / Głos" },
  { value: "room_presence", label: "Obecność" },
] as const;

export const QUICK_WAKE_DURATION_OPTIONS = [
  { minutes: 5, label: "5 min" },
  { minutes: 15, label: "15 min" },
  { minutes: 60, label: "1h+" },
] as const;

export const BOTTLE_VOLUME_PRESETS = [60, 90, 120, 150, 180] as const;

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
  { value: "wet", label: "💧 Mokra" },
  { value: "dirty", label: "💩 Brudna" },
  { value: "both", label: "💧💩 Obie" },
] as const;
