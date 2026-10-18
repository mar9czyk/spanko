import type { ChildInsightRecord } from "@/lib/types/database";
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

export const INITIAL_MOCK_INSIGHTS: readonly ChildInsightRecord[] = [
  {
    id: "insight_active_1",
    child_id: "child_leo_01",
    category: "CAT2_BEDTIME_RESISTANCE_LATENCY",
    diagnosis_code: "CAT2_OVERTIRED_FUSS",
    status: "active",
    title: "Skrócenie wieczornego okna czuwania o 15 minut",
    explanation:
      "Zauważyliśmy wzorzec marudzenia przed snem przy oknach >135 min. Przesunięcie rozpoczęcia wyciszania na 19:15 zmniejszyło opór z 35 do 12 minut.",
    algorithm_override_json: { wwOffsetMin: -15 },
    confidence_score: 0.92,
    parent_feedback: "accepted",
    previous_insight_id: "insight_hist_1",
    valid_from: "2026-10-16T18:00:00.000Z",
    created: "2026-10-16T18:00:00.000Z",
    updated: "2026-10-16T18:00:00.000Z",
  },
  {
    id: "insight_hypo_1",
    child_id: "child_leo_01",
    category: "CAT4_SHORT_NAPS_TRANSITIONS",
    diagnosis_code: "CAT4_CHRONIC_SHORT_NAP",
    status: "hypothesis",
    title: "Obserwacja łączenia cykli snu w 2. drzemce",
    explanation:
      "Druga drzemka kończy się po 32 minutach od 2 dni. Sprawdzamy, czy to chwilowy skok rozwojowy czy sygnał do wydłużenia okna czuwania.",
    algorithm_override_json: {},
    confidence_score: 0.65,
    parent_feedback: "pending",
    valid_from: "2026-10-17T12:00:00.000Z",
    created: "2026-10-17T12:00:00.000Z",
    updated: "2026-10-17T12:00:00.000Z",
  },
  {
    id: "insight_hist_1",
    child_id: "child_leo_01",
    category: "CAT2_BEDTIME_RESISTANCE_LATENCY",
    diagnosis_code: "CAT2_BEDTIME_FADING_APPLIED",
    status: "superseded",
    title: "Tymczasowe opóźnienie pory snu (Bedtime Fading)",
    explanation:
      "Początkowe przesunięcie pory snu na 20:00 w celu przełamania lęku separacyjnego i wieczornego płaczu.",
    algorithm_override_json: { forceBedtimeAnchor: "20:00" },
    confidence_score: 0.84,
    parent_feedback: "accepted",
    superseded_by_id: "insight_active_1",
    valid_from: "2026-10-10T19:00:00.000Z",
    valid_until: "2026-10-16T18:00:00.000Z",
    created: "2026-10-10T19:00:00.000Z",
    updated: "2026-10-16T18:00:00.000Z",
  },
  {
    id: "insight_hist_2",
    child_id: "child_leo_01",
    category: "CAT3_EARLY_WAKING_SPLIT_NIGHT",
    diagnosis_code: "CAT3_EXTERNAL_NOISE_ANOMALY",
    status: "corrected_by_parent",
    title: "Pobudka o 05:15 — hałas u sąsiadów",
    explanation:
      "Wczesna pobudka została zweryfikowana przez rodzica jako anomalia zewnętrzna (remont). Wpis został wykluczony z algorytmu kalibracji.",
    algorithm_override_json: {},
    confidence_score: 0.7,
    parent_feedback: "adjusted",
    parent_correction_note: "Wczoraj rano wiercił sąsiad. To jednorazowy hałas.",
    valid_from: "2026-10-08T06:00:00.000Z",
    valid_until: "2026-10-09T08:00:00.000Z",
    created: "2026-10-08T06:00:00.000Z",
    updated: "2026-10-08T07:30:00.000Z",
  },
];
