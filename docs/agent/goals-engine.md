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
| `healthy_sleep_habits` | 0 dni | min. od odłożenia do zaśnięcia | ≤ 20 |

Sukces = cel spełniony w ≥ 5 z ostatnich 7 zmierzonych nocy (doby chore i bez danych pomijane). Silnik zwraca wtedy `achieved / TARGET_REACHED`, ale status `achieved` ustawia dopiero rodzic przyciskiem na karcie celu (`POST /api/goals/status`).

## 3. Metody
`habit_building` (tylko dla `healthy_sleep_habits`, bez treningu snu): co 3 noce kolejny nawyk (`WAKE_ANCHOR` → `BEDTIME_ROUTINE` → `SLEEP_ENVIRONMENT` → `DROWSY_PUT_DOWN`) + 2 noce utrwalenia = 14 nocy; rodzic reaguje na dziecko jak zwykle, więc cel nie wymaga czerwonych flag ani „problemu do rozwiązania”.

`gentle_fading` (drabina interwencji, 2 noce na szczebel, 7–14 nocy / stopniowa redukcja mleka), `chair_method` (4 pozycje co 3 noce, 12 nocy), `pick_up_put_down` (14 nocy + utrwalenie; ≥ 120 dni, po 180 dniach ostrzeżenie `PUPD_OLDER_CHILD`, nie blokada), **stanowcze**: `check_and_console` (Ferber: noc 1: 3/5/10, noc 2: 5/10/12, noc 3: 10/12/15, noce 4–7: 12/15/17 min; wizyta do 60 s bez podnoszenia; efekt zwykle po 4–7 nocach, komunikaty `methodProgressNote`) i `extinction` (≥ 180 dni). Dostępność metod per cel: `GOAL_CATALOG`. Pod listą metod jedno zdanie o stanowisku ABM (karmienie piersią) obok AASM/AAP.

## 4. Gotowość i bezpieczeństwo (`readiness.ts`)
Blokery: wiek (korygowany!), wiek dla metody, metoda nieobsługiwana, < 3 doby danych, aktywna choroba (tagi `gorączka`, `infekcja_ucha`, `szczepienie`), niepotwierdzone czerwone flagi, brak problemu do rozwiązania. Ostrzeżenia: ząbkowanie, mało danych (< 5 dób), weź–odłóż po 6. mies.
Czerwone flagi (UI pyta rodzica, `RED_FLAGS` w `goal-copy.ts`): słaby przyrost wagi lub zalecone nocne karmienia, podejrzenie refluksu/alergii/zapalenia ucha, bezdechy/chrapanie, niepokój ruchowy (żelazo), atopia/astma/nocny kaszel, napady, objawy pilne (gorączka ≥ 38°C < 3 mies., letarg, sztywność karku, uwypuklone ciemiączko, powtarzające się wymioty), wyczerpanie lub obniżony nastrój rodzica. Disclaimer: aplikacja nie zastępuje porady lekarskiej.

## 5. Plany (`plans.ts`)
Kroki `PlanStep { code, fromDay, toDay, params }` — bez tekstów UI (teksty i tłumaczenia po stronie UI/i18n). Zadania dnia: `NIGHT_FEED_LIMIT`, `CHECK_INTERVALS`, `RESPONSE_RUNG`, `CHAIR_DISTANCE`, `PICK_UP_PUT_DOWN`, `NO_RESPONSE`, `BEDTIME_ROUTINE`.

## 6. Progresja (`progress.ts`)
`pause` (choroba) → `achieved` → `hold` (krok trwa) → po końcu kroku: `step_back` (średnia z 2 dób > 130% baseline), `advance`, albo `hold/CONSOLIDATING` na ostatnim kroku.

## 7. Źródła metod
Poziom dowodu każdej liczby (wiek, interwały, liczba nocy, progi sukcesu) jest w [`zrodla.md`](zrodla.md), sekcja 3.4. W skrócie: bramki wiekowe 16 tyg. / 120 / 180 dni mają oparcie w wytycznych i badaniach (AASM, Mindell 2006, Kempler 2016, Gradisar 2016, RACGP HANDI), interwały Ferbera i liczby nocy dla krzesła i weź–odłóż to praktyka konsultantów (Baboo), a tempo szczebli, kroki odstawiania mleka i kryterium sukcesu ≥5 z 7 nocy to heurystyki Spanko. Stanowisko ABM #37 (2023) pokazujemy obok AASM/AAP przy wyborze metody. Treści wymagają przeglądu przez konsultanta snu przed publicznym startem.

## 8. Bezpieczny sen i filtr AI (`src/lib/safe-sleep.ts`)
- Stały blok zaleceń AAP 2022 (`SAFE_SLEEP_GUIDELINES`, komponent `SafeSleepNotice`) na stronie wniosków i w kreatorze celu dla dzieci < 12 mies. wieku korygowanego. Nigdy nie generowany przez AI.
- `findUnsafeAdvice` sprawdza tekst od modelu (wnioski w `openrouter.ts`, coach w `goal-coach.ts`): spanie w łóżku dorosłych, pozycja na brzuchu/boku lub pochyła, poduszki, a poniżej 16 tyg. także trening snu. Trafienie = odpowiedź odrzucona (log `error` z kodem reguły), zostaje tekst deterministyczny. Filtr jest celowo nadgorliwy (łapie też zaprzeczenia).
- Karta „Fundamenty dobrego snu” (`src/lib/sleep-foundations.ts`, `SleepFoundationsCard`): stałe rady bez treningu dobrane do wieku korygowanego, na stronie wniosków i w kreatorze celu (nie na dashboardzie).
