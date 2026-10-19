# Dokumentacja Domenowa: Baza Danych i PocketBase

Dokument opisuje model danych, kolekcje PocketBase, reguły bezpieczeństwa API, obsługę granicy doby fizjologicznej oraz mechanizm kodów zaproszeń do gospodarstwa domowego.

---

## 1. Architektura Danych PocketBase

Baza danych działa w oparciu o silnik **PocketBase** (SQLite w trybie WAL) uruchomiony na Mikr.usie jako usługa `spanko-pb`.
Aplikacja komunikuje się z PocketBase poprzez oficjalny SDK (`pocketbase`) zainstalowany w Next.js.

### 1.1. Lista Kolekcji i Schematy

#### 1. `users` (Kolekcja Auth)
- `id` (string, primary key)
- `email` (email, unique)
- `name` (string)
- `avatar` (file/url)
- `is_admin` (bool, default: `false`) — uprawnia do dostępu do panelu `/admin` i edycji `admin_settings`.
- `household_id` (relation -> `households.id`, opcjonalne do momentu utworzenia/dołączenia do rodziny)

#### 2. `households` (Gospodarstwa Domowe)
- `id` (string, primary key)
- `name` (string, np. "Rodzina Nowaków")
- `invite_code` (string, 6-znakowy alfanumeryczny kod zaproszenia, wielkie litery i cyfry, np. `SP7K92`)
- `invite_expires_at` (datetime, ważność kodu 24h od wygenerowania)
- `ai_daily_limit_override` (number, opcjonalne; nadpisanie dziennego limitu AI — ustawia tylko admin, rodzic nie może go edytować)
- `created`, `updated` (autodate)

#### 3. `children` (Dzieci w Gospodarstwie)
- `id` (string, primary key)
- `household_id` (relation -> `households.id`, required)
- `timezone` (string IANA, np. `Europe/Warsaw`; domyślnie `Europe/Warsaw` — wyznacza granicę doby fizjologicznej niezależnie od strefy serwera)
- `name` (string)
- `birth_date` (date/datetime, format ISO)
- `due_date` (date/datetime, format ISO, opcjonalne — dla wcześniaków urodzonych $\ge 21$ dni przed terminem)
- `active_day_mode` (select: `home` | `on_the_go` | `illness_regression`, default: `home`)
- `anti_orthosomnia_mode` (bool, default: `false` — wyłącza dokładne minuty na korzyść elastycznego kompasu)
- `photo` (file, opcjonalne, `protected`, max 5 MB, jpeg/png/webp, miniatura `96x96` — zdjęcie w przełączniku dzieci; klient zmniejsza je do 512 px przed wysłaniem, a URL buduje z tokenem `pb.files.getToken()`)
- `created`, `updated` (autodate)

#### 4. `sleep_logs` (Rejestr Snów i Drzemek)
- `id` (string, primary key)
- `child_id` (relation -> `children.id`, required)
- `physiological_date` (string `YYYY-MM-DD` — klucz partycjonowania doby liczonej od porannej pobudki!)
- `type` (select: `nap` | `night`)
- `status` (select: `falling_asleep` | `sleeping` | `completed`)
- `put_down_at` (datetime ISO — rozpoczęcie usypiania)
- `fell_asleep_at` (datetime ISO — moment zaśnięcia)
- `woke_up_at` (datetime ISO, nullable — moment pobudki)
- `interventions` (json array: lista poziomów drabiny interwencji `['breast'|'bottle'|'bouncing'|'carrying'|'stroller_car'|'co_sleeping'|'patting'|'pacifier_reinsert'|'shushing_voice'|'room_presence'|'independent']`)
- `mood` (select: `easy` | `fussy` | `crying`)
- `night_wakings` (json array: `[{ wokeAt: string, fellAsleepAt?: string, estimatedDurationMin: number, fedMilk: boolean, interventions: string[] }]`)
- `is_rebound_sleep` (bool, default: `false` — flaga odsypiania oznaczana przez filtr homeostatyczny)
- `ignore_in_calibration` (bool, default: `false` — oznaczane przy anomaliach lub korekcie rodzica)
- `created`, `updated` (autodate)

#### 5. `day_context` (Zdarzenia Dnia: Karmienia i Tagi)
- `id` (string, primary key)
- `child_id` (relation -> `children.id`, required)
- `physiological_date` (string `YYYY-MM-DD`)
- `timestamp` (datetime ISO)
- `feeding_type` (select: `breast` | `bottle` | `solid` | `none`, default: `none`)
- `bottle_ml` (number, nullable)
- `breast_side` (select: `left` | `right` | `both` | `none`, default: `none`)
- `tags` (json array: `['ząbkowanie', 'gorączka', 'infekcja_ucha', 'skok_rozwojowy', 'spacer', 'ekran_przed_snem', 'goście']`)
- `event_type` (select: `feeding` | `diaper` | `tag`, opcjonalne — stare rekordy wnioskowane z `feeding_type`)
- `bottle_content` (select: `breast_milk` | `formula`), `breast_left_min` / `breast_right_min` (number, minuty karmienia piersią)
- `diaper_kind` (select: `wet` | `dirty` | `both`)
- Tagi dnia pozostają kluczami PL (np. `ząbkowanie`, `szczepienie`, `podróż`, `światło_dzienne`) — silnik od nich zależy; etykiety UI tłumaczy Faza 10.
- `notes` (string, max 500 znaków)

#### 6. `child_insights` (Ewolucyjna Baza Wniosków i Reguł Dziecka)
- `id` (string, primary key)
- `child_id` (relation -> `children.id`, required)
- `category` (string, jedna z 7 kategorii problemów snu)
- `diagnosis_code` (string, kod z deterministycznego drzewa diagnostycznego)
- `status` (select: `hypothesis` | `active` | `validated` | `corrected_by_parent` | `superseded`)
- `title` (string, zwięzły tytuł dla rodzica)
- `explanation` (text, przyjazne medycznie wyjaśnienie z rekomendacją)
- `algorithm_override_json` (json, np. `{ "wwOffsetMin": -15, "forceBedtimeAnchor": "19:45" }`)
- `confidence_score` (number, 0.0 - 1.0)
- `parent_feedback` (select: `accepted` | `rejected` | `adjusted` | `pending`, default: `pending`)
- `parent_correction_note` (text, opcjonalna notatka rodzica)
- `previous_insight_id` (relation -> `child_insights.id`, nullable — łańcuch ewolucji)
- `superseded_by_id` (relation -> `child_insights.id`, nullable)
- `valid_from` (datetime ISO)
- `valid_until` (datetime ISO, nullable)

#### 8. `ai_calls` (Log wywołań AI — źródło dla Inspektora Wniosków i limitów)
- `child_id`, `household_id`, `insight_id` (relation, opcjonalne), `kind` (`evaluate` | `sandbox`), `model`
- `request_snapshot_json` (wynik silnika: `diagnosticsSnapshot`, `metricsSnapshot`), `response_json`
- `status` (`ok` | `error` | `invalid_json`), `error_message`, `prompt_tokens`, `completion_tokens`, `latency_ms`
- Reguły: wszystkie tylko `@request.auth.is_admin = true`; zapis robi serwer kontem serwisowym (superuser). Dzienny limit AI liczony jest z `kind = 'evaluate'` z ostatnich 24h.

#### 7. `admin_settings` (Konfiguracja Globalna Bramki AI i Algorytmu)
- `id` (string, primary key)
- `openrouter_fast_model` (string, np. `google/gemini-2.5-flash`)
- `openrouter_reasoning_model` (string, np. `anthropic/claude-3.7-sonnet`)
- `system_prompt_insights` (text, wzorzec promptu dla generatora wniosków)
- `sleep_matrix_override_json` (json, opcjonalne nadpisanie domyślnej matrycy `DEFAULT_SLEEP_MATRIX`)
- `ai_daily_limit_per_household` (number, domyślnie 20 zapytań/dobę; `0` = nie ustawiono)
- `ai_disabled` (bool) — **globalny wyłącznik AI** (`true` = tylko silnik deterministyczny). Pole jest odwrócone względem planu (`ai_enabled`), bo bool w PocketBase domyślnie jest `false`, więc stary rekord wyłączyłby AI.
- `openrouter_fallback_model` (text), `ai_temperature` (0–2), `ai_max_tokens` (0–8000), `ai_timeout_ms` (0–120000) — dla liczb `0` = wartość domyślna (PocketBase zapisuje niewypełnioną liczbę jako 0).

> **Uwaga o liczbach w PocketBase:** niewypełnione pole `number` ma wartość `0`, nie `null`. Dlatego `households.ai_daily_limit_override = 0` i `ai_daily_limit_per_household = 0` oznaczają "brak nadpisania" (`resolveDailyAiLimit` w `src/lib/server/aiLimit.ts`). Do blokowania AI służą przełączniki `ai_disabled`, nie limit 0.

#### Rozszerzenia Panelu Admina v2 (kolekcje i pola)
- `users`: `is_blocked` (bool, zablokowany użytkownik dostaje 403 w API i nie ma dostępu do danych — każda reguła danych zaczyna się od `@request.auth.is_blocked = false`), `last_seen_at` (date, odświeżane przez serwer najwyżej raz na 15 min). Użytkownik nie może sam zmienić `is_admin`, `is_blocked` ani `last_seen_at`.
- `households`: `ai_disabled` (bool, tylko admin) — wyłącza AI dla gospodarstwa.
- `ai_calls`: `fallback_used` (bool), `prompt_version` (number; 0 = prompt z nadpisania lub domyślny), `category` (np. `CAT2_…`, `GOAL` dla coacha); `request_snapshot_json.context` trzyma pełny kontekst do ponownego uruchomienia (replay).
- `admin_audit_log` (tylko odczyt dla admina; zapis wyłącznie kontem serwisowym, brak edycji i usuwania): `actor_id`, `actor_email`, `action`, `target_collection`, `target_id`, `before_json`, `after_json`.
- `prompt_versions`: `version` (unikalna), `system_prompt`, `note`, `author_id`, `is_active` (tylko jedna aktywna; aktywacja kopiuje treść do `admin_settings.system_prompt_insights`).
- `sleep_matrix_versions`: `matrix_json` (null = reset do domyślnej), `note`, `source` (`save` | `restore` | `reset`), `author_id`.
- `app_content`: `key` (unikalny), `value_pl` — nadpisania tekstów (np. `tag.ząbkowanie`); odczyt dla zalogowanych niezablokowanych, zapis tylko admin.
- `announcements`: `message`, `level` (`info` | `warning`), `starts_at`, `ends_at`, `active`; zwykły użytkownik widzi tylko aktywne w oknie czasu (reguła w PocketBase).
- `feature_flags`: `key` (unikalny), `enabled`, `rollout_household_ids` (json: lista id; pusta = wszyscy), `description`. Sprawdzanie: `isFeatureEnabledFor` (`src/lib/server/featureFlags.ts`).

---

#### 9. `child_goals` (Cele snu dziecka, Faza 8–9)
- `child_id`, `goal_type` (`reduce_night_wakings` | `night_weaning` | `independent_sleep_onset`), `method` (`gentle_fading` | `chair_method` | `pick_up_put_down` | `check_and_console` | `extinction`), `status` (`readiness_check` | `active` | `paused` | `achieved` | `abandoned`)
- `started_on`, `step_started_on`, `last_evaluated_on` (doby fizjologiczne `YYYY-MM-DD`), `current_step` (number), `baseline_json`, `plan_json`, `red_flags_ack_at`, `achieved_at`
- Reguły: dostęp przez `child_id.household_id`. Tworzenie wyłącznie przez `POST /api/goals` (walidacja gotowości).

#### 10. `goal_daily_tasks` (Zadania i porady na dobę)
- `goal_id`, `physiological_date` (unikalne z `goal_id`), `tasks_json`, `done_json` (klucze odhaczonych zadań `kind:index`), `night_tip_json`, `progress_json` (decyzja silnika), `coach_json` (rady AI lub tekst deterministyczny)

## 2. Granica Doby Fizjologicznej (Physiological Day)

### 2.1. Reguła Złota Doby Dziecięcej
Doba niemowlaka **NIE pokrywa się z dobą kalendarzową (00:00 - 23:59)**.
* **Początek doby fizjologicznej:** Moment porannej pobudki ze snu nocnego (`woke_up_at` z rekordu o `type === 'night'`).
* **Koniec doby fizjologicznej:** Moment kolejnej porannej pobudki następnego poranka.
* **Przypisanie nocy:** Sen nocny rozpoczęty np. w poniedziałek o 19:30, wszystkie pobudki nocne we wtorek o 01:30 i 04:00 oraz poranna pobudka we wtorek o 06:45 **należą w całości do doby fizjologicznej Poniedziałku**.

### 2.2. Algorytm Wyznaczania Daty Fizjologicznej (`resolvePhysiologicalDate`)
1. Jeśli zdarzenie przypada w trakcie trwającego lub zakończonego snu nocnego $\rightarrow$ przyjmuje `physiologicalDate` tego snu nocnego.
2. Jeśli brak aktywnego snu nocnego, ale zdarzenie nastąpiło między 00:00 a 05:59 rano $\rightarrow$ fallback do dnia poprzedniego (`data - 24h`).
3. W pozostałych przypadkach $\rightarrow$ bieżąca data kalendarzowa `YYYY-MM-DD`.

---

## 3. Reguły Bezpieczeństwa API (API Rules)

PocketBase zabezpiecza dostęp do kolekcji poprzez wbudowane wyrażenia filtrujące:
* **`users`**:
  - `listRule`: `id = @request.auth.id || (household_id != '' && household_id = @request.auth.household_id) || @request.auth.is_admin = true`
  - `viewRule`: `id = @request.auth.id || (household_id != '' && household_id = @request.auth.household_id) || @request.auth.is_admin = true`
  - `updateRule`: `(id = @request.auth.id && @request.body.is_admin:isset = false) || @request.auth.is_admin = true` (blokuje samonadanie `is_admin`; umożliwia użytkownikowi aktualizację własnego profilu, w tym przypisanie `household_id` przy dołączaniu do rodziny)
  - Samodzielne usunięcie konta: `DELETE /api/account` (panel `/settings`, potwierdzenie e-mailem). Ostatni członek gospodarstwa usuwa najpierw gospodarstwo (kaskada: dzieci i ich dane) własnym tokenem, potem konto; konto admina usuwa tylko inny admin (409).
* **`households`**:
  - `listRule`: `@request.auth.household_id = id || (@request.auth.id != '' && invite_code != '' && invite_code = @request.query.code && invite_expires_at > @now)`
  - `viewRule`: `@request.auth.household_id = id || (@request.auth.id != '' && invite_code != '' && invite_code = @request.query.code && invite_expires_at > @now)`
  - `createRule`: `@request.auth.id != ''`
  - `updateRule`: `@request.auth.household_id = id && @request.body.ai_daily_limit_override:isset = false`
  - `deleteRule`: `@request.auth.household_id = id`
* **`children`**:
  - `listRule`: `@request.auth.household_id = household_id`
  - `createRule`: `@request.auth.household_id = household_id`
  - `updateRule`: `@request.auth.household_id = household_id`
* **`sleep_logs` & `day_context` & `child_insights`**:
  - `listRule`: `@request.auth.household_id = child_id.household_id`
  - `createRule`: `@request.auth.household_id = child_id.household_id`
  - `updateRule`: `@request.auth.household_id = child_id.household_id`
* **`ai_calls`**: wszystkie reguły `@request.auth.is_admin = true`
* **`admin_settings`**:
  - `listRule`: `@request.auth.is_admin = true`
  - `viewRule`: `@request.auth.is_admin = true`
  - `updateRule`: `@request.auth.is_admin = true`

---

## 4. Kody Zaproszeń do Rodziny (Household Sharing)

1. Pierwszy rodzic loguje się przez Google OAuth2 $\rightarrow$ system tworzy `household` i przypisuje użytkownika (`users.household_id = new_household.id`).
2. Rodzic generuje w profilu 6-znakowy kod zaproszenia (`invite_code`), ważny 24h (`invite_expires_at`).
3. Drugi rodzic loguje się swoim kontem Google, wybiera "Dołącz do istniejącej rodziny", wpisuje kod.
4. Klient wyszukuje gospodarstwo domowe po kodzie zaproszenia (`invite_code = code && invite_expires_at > now`). Klient przekazuje kod także jako `?code=` (`query: { code }`), a reguła `listRule`/`viewRule` wymaga `invite_code = @request.query.code`, więc nie da się wylistować cudzych kodów. Zalogowany użytkownik niemający jeszcze `household_id` może bezpiecznie zlokalizować właściwe gospodarstwo.
5. Klient aktualizuje rekord użytkownika (`users.update(id, { household_id: target_household.id })`), co autoryzuje reguła `updateRule` dla `users` (`id = @request.auth.id`), a następnie odświeża sesję (`authRefresh`).
6. Od tego momentu oboje rodzice posiadają ten sam `household_id` i mają pełny dostęp w czasie rzeczywistym do profilu dziecka, wpisów snu i stopera.

## Tryb DEV logowania (tylko lokalnie)
- `pb_schema.json` ma `users.passwordAuth.enabled = false` (produkcja: wyłącznie Google OAuth). `pnpm dev:seed` włącza logowanie hasłem w lokalnym PocketBase i idempotentnie tworzy: `dev@spanko.test`, `dev-admin@spanko.test` (is_admin), gospodarstwo „Dom testowy (DEV)”, dziecko „Tymon (DEV)” oraz 5 dni `sleep_logs`/`day_context`.
- Dane logowania (`DEV_USER_*`, `DEV_ADMIN_*`) generuje skrypt do `.env.development.local` (gitignored). Hasła nie trafiają do bundla — loguje je serwerowy `POST /api/dev/login`, który zwraca 404 poza `NODE_ENV=development` z lokalnym PocketBase.
- Przycisk „Zaloguj jako testowy użytkownik (DEV)” na `/login` jest widoczny tylko gdy `IS_DEV_LOGIN_ENABLED` (`src/lib/dev-auth.ts`). Dane demo (`devFixtures.ts`) pokazują się tylko bez sesji.
- Na produkcyjnym PocketBase NIE importuj ręcznie włączonego passwordAuth; po imporcie schematu pozostaje wyłączone.
