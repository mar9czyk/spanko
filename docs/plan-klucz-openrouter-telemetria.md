# Klucz OpenRouter w panelu admina + telemetria per użytkownik — plan

Stan wyjściowy (main, 4ae231b):
- Klucz OpenRouter czytany tylko z `process.env.OPENROUTER_API_KEY` (`resolveOpenRouterApiKey()` w
  `src/lib/openrouter.ts`, a także bezpośrednio w `api/admin/system`, `api/admin/dashboard`,
  `api/admin/openrouter/test`, `lib/admin/stats.ts`, `lib/goal-coach.ts`). Zmiana klucza = edycja `.env` i restart.
- `ai_calls` ma `household_id`, `child_id`, `kind`, `model`, `prompt_tokens`, `completion_tokens`, `latency_ms`,
  `status`, `fallback_used`. **Nie ma `user_id`** — dziś wiemy, które gospodarstwo wywołało AI, ale nie który rodzic.
- Koszt jest tylko szacowany z tabeli `MODEL_PRICING_USD_PER_MTOK` (`lib/admin/pricing.ts`).
- Aktywność w aplikacji: tylko `users.last_seen_at` (odświeżane w `authenticateRequest`, najwyżej co 15 min).
  Wpisy snu (`sleep_logs`) tworzy przeglądarka bezpośrednio w PocketBase i nie zapisuje autora.

Dwa etapy, każdy to osobny PR (zasada 1 sesja = 1 zadanie). Wspólne zasady z `docs/plan-panel-admina-v2.md`
obowiązują (requireAdmin, zod, klient serwisowy, audit log, czyste funkcje z testami).

---

## Etap A — klucz OpenRouter zapisywany w panelu, zaszyfrowany

### Gdzie leży co
- **Klucz główny (master key)**: nowa zmienna środowiskowa `SPANKO_SECRETS_KEY` — 32 losowe bajty w base64
  (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`). Lokalnie w `.env.local`,
  na serwerze w `.env.production`. Nigdy w bazie, repo ani w paczce deploya.
- **Zaszyfrowany klucz OpenRouter**: nowa kolekcja `app_secrets`, **wszystkie reguły `null`** (dostęp tylko kontem
  serwisowym/superuserem). Celowo nie w `admin_settings`: tę kolekcję każdy admin może czytać wprost z PocketBase,
  a `GET /api/admin/settings` zwraca cały rekord do przeglądarki.
  Pola: `name` (text, unikalne, np. `openrouter_api_key`), `ciphertext` (text), `key_suffix` (text, ostatnie
  4 znaki), `key_version` (number, na przyszłą rotację mastera), `updated_by` (relation users), `created`/`updated`.
- Kopie zapasowe PocketBase zawierają tylko szyfrogram — bez `SPANKO_SECRETS_KEY` są bezużyteczne.

### Szyfrowanie (`src/lib/server/secrets.ts`, czyste funkcje + testy)
- AES-256-GCM z `node:crypto`, losowe IV 12 B na każdy zapis, AAD = nazwa sekretu (szyfrogramu nie da się
  przenieść do innego pola). Format: `v1:<iv b64>:<tag b64>:<dane b64>`.
- `encryptSecret(name, plain)`, `decryptSecret(name, payload)`; zły master / zmieniony szyfrogram → błąd, nie śmieci.
- `maskKey(key)` → `sk-or-…a1b2`.

### Odczyt klucza
- `resolveOpenRouterApiKey()` staje się asynchroniczne i zwraca `{ key, source: "panel" | "env" | "none" }`:
  najpierw `app_secrets` (cache 30 s jak ustawienia, czyszczony po zapisie), potem `OPENROUTER_API_KEY` z env,
  potem brak. Brak mastera lub błąd odszyfrowania → fallback do env + alert na Pulpicie.
- Wszystkie miejsca czytające dziś `process.env.OPENROUTER_API_KEY` przechodzą na tę funkcję
  (lista w „Stanie wyjściowym”). Komunikaty „Brak OPENROUTER_API_KEY” zmieniamy na „Brak klucza OpenRouter”.

### API `src/app/api/admin/openrouter/key/route.ts`
- `GET` → `{ source, suffix, updatedAt, updatedByEmail, masterKeyConfigured }`. **Nigdy** sam klucz ani szyfrogram.
- `PUT { apiKey }` → walidacja zod (`sk-or-` + min. długość), **najpierw test** klucza przez
  `https://openrouter.ai/api/v1/credits` (jak dzisiejszy test), dopiero przy sukcesie szyfrowanie i zapis.
  Brak `SPANKO_SECRETS_KEY` → 503 z instrukcją. Audit: `secret.openrouter.set`, `after: { suffix }`.
- `DELETE` → usuwa klucz z panelu (wraca fallback env). Audit: `secret.openrouter.delete`, wymaga potwierdzenia w UI.
- Klucz nie trafia do `console.*`, komunikatów błędów ani `audit_log` (test to sprawdza).

### UI (zakładka „OpenRouter & Prompty”, `SettingsTab.tsx`)
- Karta „Klucz API”: źródło (Panel / Zmienna środowiskowa / Brak), zamaskowana końcówka, kto i kiedy zmienił.
- Pole typu password, puste po każdym zapisie, przyciski „Zapisz i sprawdź” oraz „Usuń klucz z panelu”.
- Gdy brak mastera: pole wyłączone + jedna linijka, jak go dodać.
- `SystemTab` / Pulpit pokazują źródło klucza zamiast samego „jest/nie ma”.

### Testy
Szyfrowanie w obie strony, zły master, podmieniony szyfrogram, kolejność źródeł (panel > env > brak),
`GET` nie zwraca klucza, `PUT` nie zapisuje klucza, który nie przeszedł testu, audit bez klucza.

---

## Etap B — telemetria per użytkownik

### Co już jest, a co dochodzi
| Dane | Dziś | Po etapie B |
|---|---|---|
| Liczba wywołań AI, błędy, latencja | per gospodarstwo | **per użytkownik** (+ gospodarstwo) |
| Tokeny wejście/wyjście | per wywołanie | sumy per użytkownik, okres, rodzaj (`kind`) |
| Koszt | szacunek z tabeli cen | **koszt z odpowiedzi OpenRouter** (`usage.cost`), szacunek jako zapas |
| Ostatnia aktywność | `last_seen_at` | bez zmian |
| Wpisy w aplikacji | brak autora | **liczba wpisów snu dodanych przez użytkownika, dni aktywne** |

### Schemat
- `ai_calls`: `user_id` (relation users, opcjonalne) i `cost_usd` (number). Stare wpisy bez `user_id` pokazujemy
  jako „gospodarstwo (sprzed telemetrii)”.
- `sleep_logs`: `created_by` (relation users). Reguła create: `@request.body.created_by = @request.auth.id`,
  update nie może go zmieniać. Klient (`useDashboardState.ts`) ustawia pole przy tworzeniu wpisu.
- Bez nowej kolekcji zdarzeń: „dni aktywne” liczymy z dat wpisów snu i wywołań AI użytkownika.
- Po zmianie schematu: re-import `pb_schema.json` lokalnie i `pnpm dev:seed` (import wyłącza logowanie hasłem).

### Serwer
- `AiCallAudit` dostaje `userId`; wypełniają go `evaluate-insights`, `correct-insight`, `goal-coach`,
  a `sandbox`/`replay`/test — id admina (te wywołania i tak są poza statystykami).
- `callOpenRouter` wysyła `usage: { include: true }` i zapisuje `usage.cost` jako `cost_usd` (format pola sprawdzić w aktualnej dokumentacji OpenRouter przed implementacją).
  Statystyki biorą `cost_usd`, a gdy go brak — `estimateCallCostUsd`.
- `src/lib/admin/usage.ts` (czyste funkcje + testy): `aggregateUsageByUser(calls, logs, users, nowMs, days)` →
  per użytkownik: wywołania, błędy, tokeny in/out, koszt, rozbicie na `kind`, wpisy snu, dni aktywne, ostatnia aktywność.
- `GET /api/admin/usage?days=7|30|90` i `GET /api/admin/usage/[userId]?days=…` (dzienne punkty do wykresu).
  Odczyt klientem serwisowym, tylko potrzebne pola (`fields`), bez treści promptów i odpowiedzi.

### UI — nowa zakładka „Telemetria”
- Przełącznik okresu 7/30/90 dni, sumy na górze (wywołania, tokeny, koszt).
- Lista użytkowników sortowana po koszcie: e-mail, gospodarstwo, wywołania (błędy), tokeny, koszt, wpisy snu,
  dni aktywne, ostatnio widziany. Mobile: karty zamiast tabeli.
- Szczegóły użytkownika: wykres dzienny wywołań i kosztu, rozbicie na rodzaje, link do Inspektora AI
  z filtrem po użytkowniku (Inspektor dostaje filtr `user_id`).
- Limit dzienny AI zostaje per gospodarstwo (bez zmian).

### Testy
Agregacja (okna czasowe, wykluczenie `sandbox`, koszt z `cost_usd` vs szacunek, wpisy bez `user_id`),
reguła `created_by`, endpoint wymaga admina.

---

## Do decyzji Gosi
1. Klucz w bazie, zaszyfrowany kluczem głównym z env, z fallbackiem na `OPENROUTER_API_KEY` — **rekomendacja**.
2. Telemetria aktywności = wpisy snu z autorem + dni aktywne, bez osobnego logu zdarzeń (prościej, mniej danych
   o rodzicach). Jeśli chcesz np. liczyć otwarcia aplikacji, dochodzi osobna kolekcja zdarzeń.
3. Kolejność: najpierw A (klucz), potem B (telemetria), dwa PR-y.
