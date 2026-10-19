# Dokumentacja Domenowa: Silnik Celów (Goals Engine)

Moduł `src/lib/goals-engine/` — deterministyczny, czysty TypeScript (bez I/O i bez LLM). AI (Faza 9) jedynie ubiera wyniki w język rodzica.

## 1. Przepływ
`DailyGoalMetrics` (z logów snu + karmień + tagów) → `computeBaseline` → `evaluateReadiness` → `generatePlan` → codziennie `buildDailyTasks` / `buildNightTip` + `evaluateProgress`.

## 2. Cele (katalog: `catalog.ts`)
| Cel | Min. wiek korygowany | Metryka (mniejsza = lepiej) | Cel sukcesu |
|---|---|---|---|
| `reduce_night_wakings` | 120 dni | pobudki / noc | ≤ 1 |
| `night_weaning` | 180 dni | nocne karmienia mleka | 0 |
| `independent_sleep_onset` | 120 dni | min. od odłożenia do zaśnięcia | ≤ 20 |

Sukces = cel spełniony przez 3 kolejne zdrowe doby z danymi.

## 3. Metody
`gentle_fading` (drabina interwencji / stopniowa redukcja mleka), `chair_method`, `pick_up_put_down` (≥ 120 dni), **stanowcze**: `check_and_console` (Ferber, tabela odstępów w `plans.ts`) i `extinction` (≥ 180 dni). Dostępność metod per cel: `GOAL_CATALOG`.

## 4. Gotowość i bezpieczeństwo (`readiness.ts`)
Blokery: wiek (korygowany!), wiek dla metody, metoda nieobsługiwana, < 3 doby danych, aktywna choroba (tagi `gorączka`, `infekcja_ucha`, `szczepienie`), niepotwierdzone czerwone flagi, brak problemu do rozwiązania. Ostrzeżenia: ząbkowanie, mało danych (< 5 dób).
Czerwone flagi (UI pyta rodzica): słaby przyrost wagi, podejrzenie refluksu/alergii/zapalenia ucha, bezdechy/chrapanie, pediatra zalecił nocne karmienia. Disclaimer: aplikacja nie zastępuje porady lekarskiej.

## 5. Plany (`plans.ts`)
Kroki `PlanStep { code, fromDay, toDay, params }` — bez tekstów UI (teksty i tłumaczenia po stronie UI/i18n). Zadania dnia: `NIGHT_FEED_LIMIT`, `CHECK_INTERVALS`, `RESPONSE_RUNG`, `CHAIR_DISTANCE`, `PICK_UP_PUT_DOWN`, `NO_RESPONSE`, `BEDTIME_ROUTINE`.

## 6. Progresja (`progress.ts`)
`pause` (choroba) → `achieved` → `hold` (krok trwa) → po końcu kroku: `step_back` (średnia z 2 dób > 130% baseline), `advance`, albo `hold/CONSOLIDATING` na ostatnim kroku.

## 7. Źródła metod
Ferber (graduated extinction/check-and-console), metoda krzesła (Kuhn & Weidinger), pick-up-put-down (Hogg), przegląd: AAP / Mindell i in. 2006 (behavioral interventions for infant sleep). Treści wymagają przeglądu przez konsultanta snu przed publicznym startem.
