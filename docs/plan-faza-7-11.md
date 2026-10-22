# Plan implementacji: Faza 7–11 (Tracker → Silnik Celów → Monetyzacja)

Źródło założeń: sekcja **0** w `SPANKO MASTER PLAN` (aktualizacja 2026-10-19). Kolejność ustalona z właścicielką produktu: **najpierw pełny tracker (tryb bazowy), potem Silnik Celów z 2–3 celami dla baby**, następnie i18n i monetyzacja.

**Status (2026-10-19):** Fazy 7–10 zaimplementowane i scommitowane (zob. `git log`). **Faza 11 (monetyzacja) celowo wstrzymana** na życzenie właścicielki produktu.
Odstępstwa od planu: i18n zrealizowane własnym lekkim modułem (`src/i18n/`) zamiast `next-intl` (zob. `docs/agent/i18n.md`). Luki z faz 7–10 zamknięte (2026-10-22): tagi dnia mają klucze neutralne EN (stare klucze PL są mapowane), prompt coacha edytuje się w Panelu Admina (bez wersjonowania), `/insights` ma sekcję „Postęp celu” (wykres + historia celów), a teksty awaryjne drzew diagnostycznych mają wersje EN.
Przed użyciem: zaimportuj zaktualizowany `pb_schema.json` do lokalnego PocketBase (nowe kolekcje `child_goals`, `goal_daily_tasks`, nowe pola `day_context`, `ai_calls.kind = goal_coach`, `admin_settings.system_prompt_goal_coach`).

Każda faza kończy się `pnpm check && pnpm test`.

---

## FAZA 7: Pełny Tracker (tryb bazowy, Free)

**Cel:** rejestrować wszystko, co wpływa na sen, jednym kciukiem.

### 7.1. Baza danych (PocketBase + `docs/agent/database.md`)
Istnieje: `sleep_logs` (z `interventions`, `night_wakings`), `day_context` (karmienia + tagi). Zmiany:
- `day_context` → rozbić semantycznie na typ zdarzenia: dodać `event_type` (select: `feeding` | `diaper` | `tag`), zachowując kompatybilność wsteczną (migracja: istniejące rekordy z `feeding_type != none` → `feeding`, reszta → `tag`).
- Karmienie: dodać `feeding_started_at`, `feeding_ended_at` (pierś — czas trwania per strona), `breast_left_min`, `breast_right_min`, `bottle_content` (select: `breast_milk` | `formula`), `solid_note`.
- Pielucha: `diaper_kind` (select: `wet` | `dirty` | `both`).
- Tagi: rozszerzyć słownik o `szczepienie`, `podróż`, `światło_dzienne`; klucze tagów po angielsku (`teething`, `fever`, ...) z tłumaczeniem w UI (przygotowanie pod i18n).
- `children`: `units` (select: `metric` | `imperial`) — lub na poziomie `households`.
- Aktualizacja `pb_schema.json` + migracja + reguły API (jak dla `day_context`).

### 7.2. Silnik deterministyczny (`src/lib/sleep-engine/`)
- Nowy moduł `feedingSignals.ts`: czas od ostatniego karmienia, karmienie < 30 min przed snem, „feed-to-sleep” (karmienie kończy się w oknie usypiania), suma nocnego mleka (ml / minuty piersi), liczba nocnych karmień.
- Podpiąć sygnały do istniejących drzew diagnostycznych (np. pobudki nocne ↔ nocne karmienia, krótkie drzemki ↔ głód).
- Testy Vitest dla każdego sygnału + przypadki brzegowe (karmienie przez granicę doby fizjologicznej).

### 7.3. UI (`src/components/dashboard/`)
- `QuickEntryBottomSheet` → zakładki: Karmienie / Pielucha / Czynniki. Pierś: stoper L/P z przełączaniem strony jednym dotknięciem (sync realtime jak stoper snu).
- `FloatingActionBar`: obok przycisku snu stałe szybkie akcje 🍼 i 🧷 (jedno dotknięcie = wpis „teraz”, długie przytrzymanie = formularz).
- Tryb nocny: „⚡ Pobudka / Mleko” zapisuje też ilość mleka (pigułki ml) bez klawiatury.
- `PhysiologicalTimeline` / `TimelineEventCard`: karty karmień i pieluch.
- Prosty widok historii/statystyk karmień i pieluch (dzienne sumy) w `/insights`.

**Definition of done:** rodzic zapisuje karmienie, pieluchę i czynnik w ≤ 2 dotknięciach; dane widoczne na osi i u drugiego rodzica w czasie rzeczywistym; sygnały karmienia pokryte testami.

---

## FAZA 8: Silnik Celów (Goals Engine) — deterministyczny rdzeń

**Cel:** pure TS moduł prowadzący rodzica do celu. Zero LLM w decyzjach.

### 8.1. Dokumentacja
- Nowy plik `docs/agent/goals-engine.md` (+ wpis w `CLAUDE.md`/`AGENTS.md` w Progressive Disclosure): model celu, metody, kryteria gotowości, czerwone flagi, reguły progresji, bibliografia.

### 8.2. Model danych
- Nowa kolekcja `child_goals`: `child_id`, `goal_type` (`reduce_night_wakings` | `night_weaning` | `independent_sleep_onset`), `method` (`gentle_fading` | `chair_method` | `pick_up_put_down` | `check_and_console` (Ferber) | `extinction`), `status` (`readiness_check` | `active` | `paused` | `achieved` | `abandoned`), `started_at`, `baseline_json` (metryki z 7 dni przed startem), `target_json`, `current_step`, `plan_json` (wygenerowany plan), `red_flags_ack_at`.
- Nowa kolekcja `goal_daily_tasks`: `goal_id`, `physiological_date`, `tasks_json` (`[{ id, kind, params, done }]`), `outcome_json` (metryki dnia).
- Reguły API jak dla `child_insights` (household scope).

### 8.3. Moduły `src/lib/goals-engine/`
- `catalog.ts` — definicje 3 celów: wymagany min. wiek (korygowany), dostępne metody per wiek (stanowcze ≥ 6 mies.), metryka sukcesu (np. pobudki/noc, nocne ml, minuty usypiania, % samodzielnych zaśnięć).
- `readiness.ts` — ocena gotowości z danych trackera (min. 3–7 dni danych, brak aktywnych tagów choroby/ząbkowania, waga/wiek dla odstawienia nocnego mleka) + lista czerwonych flag do potwierdzenia.
- `plans/*.ts` — generatory planów per cel × metoda, np. `night_weaning`: redukcja butelki o X ml co N nocy / skracanie piersi o 1–2 min; Ferber: tabela odstępów sprawdzania dzień po dniu.
- `progress.ts` — porównanie z baseline, decyzja: `advance` | `hold` | `step_back` | `pause` (np. choroba) | `achieved`.
- `dailyTasks.ts` — 1–3 zadania na dziś + podpowiedź nocna (co robić przy pobudce w danym kroku planu).
- Pełne testy Vitest (każdy plan, każda decyzja progresji, granice wieku).

**Definition of done:** dla przykładowych danych z fixtures silnik deterministycznie generuje plan, zadania dnia i decyzję progresji; 100% testów zielonych.

---

## FAZA 9: Coaching AI + Ekran „Ścieżka Celu”

### 9.1. Insights → coaching (`src/app/api/ai/`, `docs/agent/ai-and-admin.md`)
- Zmiana schematu Zod odpowiedzi: zamiast „wyjaśnienia” → `{ headline, todayAdvice[], nightTip, encouragement, whyExpandable }`.
- Wejście do promptu: cel, metoda, krok planu, zadania dnia, wynik `progress.ts`, sygnały z trackera. AI tylko formułuje — nie zmienia liczb/kroków.
- Nowy endpoint `POST /api/ai/goal-coach` (wywoływany rano po zamknięciu nocy i na żądanie); istniejące `evaluate-insights` dalej działa dla rodziców bez celu, ale z promptem nastawionym na rady.
- Human-in-the-Loop: „To nie zadziałało / nie dam rady dziś” → `progress.ts` dostaje sygnał `hold`/`step_back`.
- Panel Admina: prompty `goal_coach_prompt` per język, podgląd planów w Inspektorze.

### 9.2. UI
- Onboarding celu (`/goals/new`): wybór celu → ocena gotowości → czerwone flagi (checkboxy) → wybór metody (opis, czas trwania, „ile płaczu”) → podsumowanie planu.
- Dashboard „Ścieżka Celu”: `GoalProgressBar` (dzień X/Y, metryka start → teraz), `TodayTasksCard` (odhaczanie kciukiem), prognoza drzemki jako element drugorzędny, istniejąca oś doby, `FloatingActionBar` bez zmian.
- Tryb nocny z aktywnym celem: duży licznik pobudek + `NightTipCard` (instrukcja kroku planu, np. odstęp Ferbera z odliczaniem).
- Bez aktywnego celu: obecny widok „Tu i Teraz” + karta „Wybierz cel”.
- `/insights` → „Postęp celu” (wykres metryki vs baseline) + historia celów.

**Definition of done:** rodzic przechodzi od wyboru celu do 1. nocy planu bez pisania; rano widzi rady na dziś i postęp.

---

## FAZA 10: Internacjonalizacja (EN/PL)

- `next-intl` (App Router), słowniki `messages/en.json`, `messages/pl.json`; EN domyślny, wykrywanie z przeglądarki + wybór w ustawieniach.
- Wszystkie stringi UI, tagi, opisy celów i metod przez klucze.
- Jednostki ml/oz, format godzin 12h/24h, strefy czasowe (zapis w UTC, prezentacja lokalna — weryfikacja `physiologicalDay.ts`).
- Prompty AI i schematy odpowiedzi z parametrem `locale`.

---

## FAZA 11: Monetyzacja

- Model: Free (tracker + podstawowa prognoza) / Premium (cele, coaching AI, pełny plan dnia, raport PDF) / jednorazowy Program Celu / trial 7 dni od wyboru 1. celu.
- Kolekcja `subscriptions` (household scope): `plan`, `status`, `provider`, `expires_at`, `purchased_goal_type`.
- Płatności web: Stripe Checkout + webhook (`/api/billing/webhook`) aktualizujący `subscriptions`. Po przejściu na Capacitor: RevenueCat dla App Store / Google Play.
- `requirePremium()` po stronie serwera (endpointy AI i Goals) + paywall w UI w momencie wyboru celu (nie przy logowaniu danych).
- Limity AI (już są w Panelu Admina) zależne od planu.
- Raport PDF dla pediatry (7/30 dni: sen, karmienia, pieluchy).

---

## Ryzyka i decyzje otwarte
- **Brak eksperta:** treści metod opieramy na publikowanych źródłach; przed publicznym startem warto zlecić przegląd konsultantowi snu.
- **Prawne:** disclaimer medyczny, RODO/GDPR (dane dziecka), polityka prywatności przed płatnościami.
- **Push na iOS w PWA** wymaga instalacji na ekranie głównym — onboarding musi to prowadzić; Capacitor rozwiązuje to w pełni.
- Cele dla toddlerów (rezygnacja z drzemki, wczesne pobudki, przeprowadzka do łóżka) — po walidacji 3 celów baby.
