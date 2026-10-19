# Panel Admina v2 — plan i prompty

Stan wyjściowy: `src/app/(app)/admin/page.tsx` z 4 zakładkami (OpenRouter & Prompty, Inspektor, Matryca,
Gospodarstwa), API w `src/app/api/admin/*` chronione `requireAdmin` (`src/lib/server/auth.ts`), kolekcja `ai_calls`.
Realizuj prompty **po kolei** (każdy etap zakłada poprzedni). Po każdym: `pnpm check && pnpm test`, ręczny test
na lokalnym PocketBase (`pnpm dev:seed` tworzy testowego admina), commit dopiero po akceptacji.

Zasady wspólne dla wszystkich etapów (wklejone też w każdy prompt):
- Każdy endpoint `/api/admin/*` zaczyna się od `requireAdmin`, body walidowane zod, odczyt cudzych danych
  wyłącznie klientem serwisowym (`getServiceClient`) PO sprawdzeniu admina.
- Każda zmieniająca operacja admina zapisuje wpis w `admin_audit_log` (od etapu A).
- Nowe kolekcje w `pb_schema.json` w formacie PocketBase 0.23+ (`fields`, reguły z `@now`), wszystkie reguły
  admin-only (`@request.auth.is_admin = true`) chyba że zaznaczono inaczej; aktualizuj `src/lib/types/database.ts`
  i `docs/agent/database.md`.
- UI zgodne z `docs/agent/ux-guidelines.md` (dark `#0B0F17`, mobile-first, przyciski min-h-11), komponenty w
  `src/components/admin/`. Operacje nieodwracalne wymagają potwierdzenia (wpisanie nazwy/e-maila).
- Żadnych obliczeń przez LLM; logika liczb (statystyki, koszty) jako czyste funkcje z testami Vitest.

---

## PROMPT ETAP A — Pulpit, Użytkownicy, Dziennik działań

```text
Przeczytaj AGENTS.md, docs/agent/database.md, docs/agent/ai-and-admin.md oraz docs/plan-panel-admina-v2.md (zasady wspólne).
Rozbuduj Panel Admina Spanko o Pulpit, zarządzanie Użytkownikami i Dziennik działań adminów.

1. Schemat (pb_schema.json, format 0.23+):
   - Nowa kolekcja `admin_audit_log`: actor_id (relation users), action (text, np. `user.set_admin`),
     target_collection, target_id, before_json, after_json, created (autodate). Reguły: list/view admin-only,
     create/update/delete = null (zapis tylko klientem serwisowym; wpisów nie da się edytować ani usuwać).
   - `users`: dodaj `is_blocked` (bool) i `last_seen_at` (date). Reguły users nie mogą pozwalać użytkownikowi
     zmieniać `is_admin`, `is_blocked` (`@request.body.is_blocked:isset = false`).
   - Zablokowany użytkownik: `authenticateRequest` zwraca 403; dodaj też warunek `@request.auth.is_blocked = false`
     do reguł kolekcji danych (children, sleep_logs, day_context, child_insights).
   - `last_seen_at` aktualizuj w authenticateRequest najwyżej raz na 15 min (klient serwisowy, błąd nie przerywa żądania).

2. Serwer:
   - `src/lib/server/audit.ts`: `writeAuditLog({ actorId, action, targetCollection, targetId, before, after })`.
   - `src/lib/admin/stats.ts` (czyste funkcje + testy): agregacja ai_calls na dzień/model, odsetek błędów i
     `invalid_json`, średnia latencja, szacowany koszt z tabeli cen modeli (stała `MODEL_PRICING_USD_PER_MTOK`
     w `src/lib/admin/pricing.ts`, edytowalna ręcznie).
   - API: `GET /api/admin/dashboard` (liczby gospodarstw/dzieci/użytkowników, aktywni 1/7/30 dni wg last_seen_at,
     statystyki AI 24h/7d/30d, koszt, alerty: gospodarstwa >=80% limitu, odsetek błędów AI >10% w 24h, brak
     OPENROUTER_API_KEY);
     `GET /api/admin/users` (paginacja, szukanie po e-mailu, filtr admin/zablokowany);
     `PATCH /api/admin/users/[id]` (is_admin, is_blocked, household_id) — zablokuj odebranie admina samemu sobie
     i ostatniemu adminowi (409);
     `DELETE /api/admin/users/[id]` (RODO: usuwa usera; gdy był jedynym członkiem gospodarstwa — usuwa gospodarstwo
     kaskadowo; wymaga w body `confirmEmail` równego e-mailowi usera);
     `GET /api/admin/audit-log` (paginacja, filtr po action/actor).
   - Każda operacja PATCH/DELETE (także istniejące: settings, households) zapisuje audit log.

3. UI: zakładki w kolejności Pulpit (domyślna) | Użytkownicy | Gospodarstwa | OpenRouter & Prompty | Inspektor |
   Matryca | Dziennik. Pulpit: kafelki liczb + prosty wykres słupkowy wywołań/kosztu z 14 dni (bez nowych zależności,
   SVG) + lista alertów. Użytkownicy: lista z wyszukiwarką, przełączniki admin/blokada, modal usunięcia z wpisaniem
   e-maila. Dziennik: lista z rozwijanym diffem before/after.

4. Testy Vitest: stats/pricing, reguła „ostatni admin” (409), blokada samodegradacji, walidacja confirmEmail,
   authenticateRequest dla zablokowanego (403).

Nie commituj. Uruchom `pnpm check && pnpm test`, sprawdź panel w przeglądarce na lokalnym PocketBase
(zaloguj się testowym adminem z `pnpm dev:seed`) i wypisz, co trzeba zaimportować ręcznie.
```

---

## PROMPT ETAP B — AI: wyłącznik, fallback, wersje promptów, Inspektor z filtrami i statystykami

```text
Przeczytaj AGENTS.md, docs/agent/ai-and-admin.md oraz docs/plan-panel-admina-v2.md (zasady wspólne). Etap A jest gotowy.
Rozbuduj konfigurację AI i Inspektor Wniosków.

1. Schemat:
   - `admin_settings`: dodaj `ai_enabled` (bool, domyślnie true), `openrouter_fallback_model` (text),
     `ai_temperature` (number 0–2), `ai_max_tokens` (number), `ai_timeout_ms` (number).
   - `households`: dodaj `ai_disabled` (bool).
   - Nowa kolekcja `prompt_versions`: version (number), system_prompt (text), note (text), author_id (relation users),
     is_active (bool), created. Admin-only.
2. Serwer:
   - `src/lib/openrouter.ts`: respektuj ai_enabled / households.ai_disabled (endpoint evaluate-insights zwraca wtedy
     sam wynik silnika deterministycznego z polem `aiSkipped: true`, bez błędu dla rodzica), timeout przez
     AbortController, przy błędzie/timeout/invalid_json jedna próba na fallback model; zapisuj w ai_calls
     `model_used` i `fallback_used`.
   - Prompt systemowy czytaj z aktywnej `prompt_versions` (fallback: admin_settings.system_prompt_insights).
   - API: `GET/POST /api/admin/prompts` (lista wersji, nowa wersja), `POST /api/admin/prompts/[id]/activate`
     (rollback = aktywacja starszej wersji), `POST /api/admin/openrouter/test` (ping modelu + stan kredytów z
     `GET https://openrouter.ai/api/v1/credits`; klucz tylko po stronie serwera).
   - `GET /api/admin/ai-calls`: filtry household_id, child_id, category, model, status, zakres dat;
     `GET /api/admin/ai-quality` (czysta funkcja + testy): odsetek accepted/corrected/pending wniosków per kategoria
     CAT1–CAT7 i per wersja promptu, lista ostatnich `parent_correction_note`.
   - `POST /api/admin/ai-calls/[id]/replay`: ponownie wysyła zapisany `request_snapshot_json` z wybranym promptem/modelem,
     NIE tworzy wniosku, loguje ai_calls kind=`sandbox`, zwraca obie odpowiedzi do porównania.
   - Wszystkie zmiany → admin_audit_log.
3. UI:
   - OpenRouter & Prompty: globalny wyłącznik AI (z potwierdzeniem), model główny + fallback, temperature/max_tokens/
     timeout, przycisk „Test połączenia” ze stanem kredytów, historia wersji promptu z podglądem diff (prosty diff
     liniowy, czysta funkcja z testem) i przyciskiem „Przywróć”.
   - Gospodarstwa: przełącznik „AI wyłączone” per gospodarstwo.
   - Inspektor: pasek filtrów, zakładka „Jakość” (tabela kategorii × accepted/corrected, wybór wersji promptu),
     lista korekt rodziców, przycisk „Odtwórz z innym promptem” z widokiem side-by-side.
4. Testy: fallback (mock fetch: błąd → fallback → ok), timeout, ai_enabled=false nie woła fetch, statystyki jakości,
   diff promptów.

Nie commituj. `pnpm check && pnpm test`, ręczny test w przeglądarce (bez prawdziwego klucza: sprawdź ścieżkę błędu i wyłącznika).
```

---

## PROMPT ETAP C — Wsparcie (dzieci/dane/RODO), Matryca z historią, Treści, System

```text
Przeczytaj AGENTS.md, docs/agent/database.md, docs/agent/sleep-engine.md oraz docs/plan-panel-admina-v2.md (zasady wspólne).
Etapy A i B są gotowe. Dodaj narzędzia wsparcia, historię matrycy, treści i zakładkę System.

1. Wsparcie (zakładka „Dzieci”):
   - `GET /api/admin/children` (szukanie po nazwie/gospodarstwie) i `GET /api/admin/children/[id]`: profil, wiek
     efektywny, tryb dnia, ostatnie 14 dób logów (tylko odczyt).
   - `POST /api/admin/children/[id]/recompute`: uruchamia WYŁĄCZNIE silnik deterministyczny (3 napędy +
     evaluateAll7DiagnosticCategories) na aktualnych danych, bez OpenRoutera; zwraca wynik do podglądu.
   - `GET /api/admin/households/[id]/export`: eksport JSON wszystkich danych gospodarstwa (RODO), plik do pobrania.
   - `PATCH /api/admin/sleep-logs/[id]`: tylko naprawa „zawieszonego” snu (status != completed starszy niż 24h →
     ustawienie woke_up_at i completed), z potwierdzeniem.
   - KAŻDY odczyt danych dziecka/eksport też zapisuje admin_audit_log (action `child.view`, `household.export`).
   - Szczegóły gospodarstwa: członkowie, dzieci, aktywny kod zaproszenia, akcje „Unieważnij kod” / „Nowy kod”.
2. Matryca:
   - Kolekcja `sleep_matrix_versions` (matrix_json, note, author_id, created); zapis matrycy tworzy nową wersję,
     możliwy rollback.
   - Podgląd skutków przed zapisem: czysta funkcja porównująca `predictNextSleepSlot` i `calculateCircadianParameters`
     dla 3 przykładowych profili dziecka (np. 10 tyg., 6 mies., 14 mies.) stara vs nowa matryca; UI pokazuje różnice
     SweetSpot w minutach.
3. Treści:
   - Kolekcja `app_content` (key, value_pl, updated) — teksty porad i etykiety tagów dnia; publiczny odczyt dla
     zalogowanych (`@request.auth.id != ''`), zapis admin-only; frontend używa wartości z bazy z fallbackiem do stałych
     w kodzie.
   - Kolekcja `announcements` (message, level info/warning, starts_at, ends_at, active); baner na dashboardzie
     dla aktywnego ogłoszenia (odczyt dla zalogowanych).
4. System:
   - Kolekcja `feature_flags` (key, enabled, rollout_household_ids json, description); helper
     `isFeatureEnabled(key, householdId)` (czysta funkcja + testy) używany po stronie serwera.
   - `GET /api/admin/system`: wersja aplikacji (package.json), wersja PocketBase (`/api/health`), data ostatniej
     kopii zapasowej (PocketBase `GET /api/backups`), `POST /api/admin/system/backup` (tworzy backup przez API
     PocketBase klientem serwisowym).
5. UI: nowe zakładki Dzieci, Treści, System; Matryca z historią wersji i podglądem skutków. Jeśli zakładek jest > 7,
   zamień pasek na menu boczne/rozwijane na mobile.
6. Testy: recompute nie woła fetch, porównanie matryc, isFeatureEnabled, walidacja naprawy zawieszonego snu,
   audit log przy odczycie danych dziecka.

Nie commituj. `pnpm check && pnpm test`, ręczny test w przeglądarce na lokalnym PocketBase.
```
