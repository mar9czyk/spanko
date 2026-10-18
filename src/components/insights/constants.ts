import type { CategoryPresentationConfig } from "./types";

export const CATEGORY_PRESENTATIONS: Record<string, CategoryPresentationConfig> = {
  CAT1_ASSOCIATIONS_NIGHT_WAKINGS: {
    label: "Asocjacje senne & Pobudki",
    badgeStyle: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  },
  CAT2_BEDTIME_RESISTANCE_LATENCY: {
    label: "Opór wieczorny & Okno czuwania",
    badgeStyle: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  CAT3_EARLY_WAKING_SPLIT_NIGHT: {
    label: "Wczesne pobudki & Split Night",
    badgeStyle: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  },
  CAT4_SHORT_NAPS_TRANSITIONS: {
    label: "Drzemki & Przejścia",
    badgeStyle: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  },
  CAT5_REGRESSION_ILLNESS_CRISIS: {
    label: "Regresje & Kryzysy",
    badgeStyle: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  },
  CAT6_NEWBORN_DAY_NIGHT_ACTIVE_SLEEP: {
    label: "Noworodek & Active Sleep",
    badgeStyle: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  },
  CAT7_NIGHT_WEANING_FEEDING: {
    label: "Karmienia nocne & Odstawianie",
    badgeStyle: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
};

export const DEFAULT_CATEGORY_PRESENTATION: CategoryPresentationConfig = {
  label: "Analiza Rytmu Snu",
  badgeStyle: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};
