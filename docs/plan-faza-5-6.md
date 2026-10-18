# Plan realizacji Faz 5 i 6 (Panel Admina + PWA/Deploy)

Stan wyjściowy: Fazy 0–4 zrobione, poprawki bezpieczeństwa wprowadzone (`src/lib/server/auth.ts`:
`authenticateRequest`, `getServiceClient`, `ApiAuthError`; limit AI w `evaluate-insights`).
Kolejność: **najpierw Faza 5, potem Faza 6** (deploy powinien wypchnąć już kompletną aplikację).

---

## Faza 5 – Panel Admina

### Luki w oryginalnym master planie, które trzeba domknąć
1. **Brak źródła danych dla „Inspektora Wniosków”.** Plan nie przewiduje zapisu wywołań AI.
   Potrzebna nowa kolekcja `ai_calls` (log każdego wywołania: wejście silnika, odpowiedź modelu,
   model, tokeny, czas, status). Przy okazji limit dzienny liczyć z `ai_calls`, a nie z `child_insights`
   (wniosek nie zawsze powstaje, a wywołanie i tak kosztuje).
2. **`sleep_matrix_override_json` nie jest nigdzie używany.** Silnik musi przyjmować matrycę z
   `admin_settings` (z walidacją zod i fallbackiem do `DEFAULT_SLEEP_MATRIX`), inaczej zakładka
   „Matryca” nic nie zmienia.
3. **Admin bez gospodarstwa.** `authenticateRequest` rzuca 403, gdy brak `household_id`. Potrzebny
   osobny `requireAdmin(request)`, który nie wymaga gospodarstwa, ale wymaga `is_admin === true`
   (sprawdzane po `authRefresh`, nigdy z danych klienta).
4. **Pole `is_admin` nie może być edytowalne przez użytkownika.** Reguła `updateRule` kolekcji `users`
   musi blokować zmianę `is_admin` i `household_id` na dowolną wartość (`@request.body.is_admin:isset = false`).
5. **Lista gospodarstw i zużycie** – zwykły użytkownik ich nie widzi z reguł; endpointy admina
   czytają je klientem serwisowym (`getServiceClient`) dopiero po `requireAdmin`.

### Kroki
1. Schemat: kolekcja `ai_calls`, reguły admin-only, blokada `is_admin` w `users`; aktualizacja
   `pb_schema.json`, `src/lib/types/database.ts`, `docs/agent/database.md`.
2. Serwer: `requireAdmin` w `src/lib/server/auth.ts`; logowanie wywołań w `openrouter.ts`;
   loader matrycy `src/lib/sleep-engine/matrixOverride.ts` (czysta funkcja + testy).
3. API `src/app/api/admin/*` (wszystkie za `requireAdmin`): `settings` (GET/PUT), `sandbox` (POST,
   nie zapisuje wniosków, ale liczy się do logu z flagą `sandbox`), `ai-calls` (GET, paginacja),
   `households` (GET + PATCH limitu).
4. UI `src/app/(app)/admin/page.tsx` z 4 zakładkami; dostęp: przekierowanie, gdy nie admin
   (ochrona UI to tylko wygoda – prawdziwa ochrona jest w API).
5. Testy: `requireAdmin` (401/403/ok), walidacja matrycy, schematy zod endpointów.

---

## Faza 6 – PWA + lokalny build i deploy na Mikr.us

### Pułapki do uwzględnienia (poza planem)
1. **Windows:** `deploy.sh` wymaga Git Bash, a **Git Bash nie ma `rsync`**. Skrypt ma wykrywać brak
   `rsync` i używać zamiast niego `tar | ssh 'tar -x'` (z zachowaniem `.env.production`).
2. **pnpm + standalone:** `.next/standalone/node_modules` zawiera symlinki pnpm – przy kopiowaniu
   rozwiązywać je (`rsync -L` / `tar -h`), inaczej serwer nie znajdzie modułów.
3. **`NEXT_PUBLIC_*` są wbudowywane w czasie builda.** Lokalny build musi czytać `.env.production.local`
   z `NEXT_PUBLIC_POCKETBASE_URL=https://<domena>/pb`. Sekrety (`OPENROUTER_API_KEY`,
   `POCKETBASE_SUPERUSER_*`) są tylko w `/opt/spanko/web/.env.production` na serwerze, nigdy w paczce.
4. **Caddy `handle_path /pb/*` obcina prefiks** – w Google Cloud Console redirect URI OAuth to
   `https://<domena>/pb/api/oauth2-redirect`.
5. **Mikr.us:** tańsze plany nie mają publicznego IPv4 na 80/443 – sprawdzić, czy domena idzie przez
   IPv6 (rekord AAAA) lub przez proxy Mikr.usa; od tego zależy, czy Caddy sam zrobi certyfikat.
6. **Nie uruchamiać usług jako `root`** – dedykowany użytkownik `spanko`, `NoNewPrivileges`, `ProtectSystem`.
7. **Kopie zapasowe PocketBase** (`pb_data`) – timer systemd z `sqlite3 .backup` lub wbudowane backupy.
8. **Wersja:** projekt jest na Next 16 – trzymać się aktualnego API `manifest.ts` / `metadata.appleWebApp`.

### Kroki
1. PWA: `src/app/manifest.ts`, ikony 192/512/maskable + `apple-touch-icon` w `public/icons/`,
   `metadata`/`viewport` w `layout.tsx` (`themeColor #0B0F17`, `appleWebApp`). Service worker
   opcjonalny w MVP (tylko instalowalność; bez cache'owania danych API).
2. `scripts/deploy.sh` (+ `"deploy"` w `package.json`), konfiguracja przez `scripts/deploy.env`
   (gitignored) z `deploy.env.example`.
3. `deploy/mikrus/`: `Caddyfile`, `spanko-pb.service`, `spanko-web.service`, `spanko-pb-backup.{service,timer}`,
   `.env.production.example`, `README.md` (jednorazowa instrukcja instalacji serwera).
4. Healthcheck po deployu: `curl -f https://<domena>/` i `/pb/api/health`.

---

## PROMPT FAZA 5 (wklej do Claude Code)

```text
Przeczytaj AGENTS.md, docs/agent/ai-and-admin.md, docs/agent/database.md oraz docs/plan-faza-5-6.md (sekcja Faza 5).
Zbuduj chroniony Panel Admina Spanko.

1. Schemat danych:
   - Dodaj kolekcję `ai_calls` do pb_schema.json: child_id, household_id, kind (`evaluate` | `sandbox`),
     model, request_snapshot_json (wynik silnika: diagnosisCode, metricsSnapshot), response_json,
     status (`ok` | `error` | `invalid_json`), error_message, prompt_tokens, completion_tokens, latency_ms,
     insight_id, created. Reguły: list/view/create/update/delete tylko `@request.auth.is_admin = true`
     (zapis robi serwer klientem serwisowym).
   - W `users.updateRule` zablokuj zmianę `is_admin` przez użytkownika (`@request.body.is_admin:isset = false`).
   - Zaktualizuj src/lib/types/database.ts i docs/agent/database.md.

2. Serwer:
   - W src/lib/server/auth.ts dodaj `requireAdmin(request)`: weryfikuje token przez authRefresh,
     NIE wymaga household_id, rzuca ApiAuthError 401/403 gdy `is_admin !== true`.
   - W src/lib/openrouter.ts zapisuj każde wywołanie do `ai_calls` (getServiceClient; błąd zapisu logu
     nie może przerwać odpowiedzi). Przełącz limit dzienny w evaluate-insights na liczenie `ai_calls`
     kind=`evaluate` dla household_id z ostatnich 24h.
   - Utwórz src/lib/sleep-engine/matrixOverride.ts: czysta funkcja `resolveSleepMatrix(overrideJson)`
     walidująca zod-em (ciągłe zakresy dni 0–1095, wartości dodatnie, wwMinMorning <= wwMaxEvening),
     zwracająca DEFAULT_SLEEP_MATRIX przy błędzie. Użyj jej w evaluate-insights przy getAgeBracket.

3. API (każdy handler zaczyna od requireAdmin, wejście walidowane zod, błędy przez ApiAuthError):
   - src/app/api/admin/settings/route.ts — GET/PUT admin_settings (modele, system_prompt_insights,
     sleep_matrix_override_json, ai_daily_limit_per_household).
   - src/app/api/admin/sandbox/route.ts — POST { prompt?, model?, sample } : uruchamia silnik na
     przykładowych danych (fixture w src/lib/server/sandboxFixtures.ts) i OpenRouter z podanym promptem,
     NIE tworzy child_insights, loguje ai_calls kind=`sandbox`.
   - src/app/api/admin/ai-calls/route.ts — GET z paginacją i filtrem status; dołącz parent_feedback
     powiązanego wniosku (accepted / corrected).
   - src/app/api/admin/households/route.ts — GET lista gospodarstw z liczbą dzieci i zużyciem AI (24h / 7 dni);
     PATCH nadpisanie limitu dla gospodarstwa (dodaj pole `ai_daily_limit_override` w households).

4. UI src/app/(app)/admin/page.tsx (styl z docs/agent/ux-guidelines.md, dark #0B0F17, mobile-first):
   - Zakładki: "OpenRouter & Prompty" (wybór modeli: google/gemini-2.5-flash, anthropic/claude-sonnet-4.5,
     openai/gpt-4o-mini + pole własne; edytor promptu; przycisk "Testuj w Sandboxie" z podglądem JSON),
     "Inspektor Wniosków" (lista ai_calls: silnik -> JSON modelu -> reakcja rodzica),
     "Matryca Snu 0–36 msc" (edytowalna tabela, walidacja przed zapisem, przycisk "Przywróć domyślne"),
     "Gospodarstwa i Limity".
   - Gdy użytkownik nie jest adminem — przekieruj na /dashboard. Komponenty w src/components/admin/.
   - Wywołania API z nagłówkiem Authorization: Bearer <pb.authStore.token> (jak w src/lib/client-data.ts).

5. Testy Vitest: requireAdmin (brak tokena 401, nie-admin 403, admin ok), resolveSleepMatrix
   (poprawna, dziurawa, odwrócone okna), walidacja body endpointów admina.

Nie używaj LLM do żadnych obliczeń. Nie commituj. Uruchom `pnpm check && pnpm test` i napraw wszystkie błędy.
Na koniec wypisz, co trzeba ręcznie zaimportować/sprawdzić w PocketBase.
```

---

## PROMPT FAZA 6 (wklej do Claude Code, po zakończeniu Fazy 5)

```text
Przeczytaj AGENTS.md oraz docs/plan-faza-5-6.md (sekcja Faza 6). Projekt jest na Next 16 (output: 'standalone'),
pnpm, deweloper pracuje na Windows (Git Bash). Przygotuj PWA i lokalny deploy przez SSH na VPS Mikr.us.

1. PWA:
   - src/app/manifest.ts: name "Spanko", short_name "Spanko", start_url "/dashboard", display "standalone",
     orientation "portrait", background_color i theme_color "#0B0F17", ikony 192, 512 i 512 maskable.
   - Wygeneruj proste ikony PNG (księżyc w ciepłym bursztynie na #0B0F17) do public/icons/ oraz
     apple-touch-icon 180x180 (skrypt generujący w scripts/, bez nowych zależności runtime).
   - W src/app/layout.tsx: metadata.appleWebApp (capable, statusBarStyle "black-translucent", title),
     export viewport z themeColor "#0B0F17", viewportFit "cover". Bez service workera cache'ującego API.

2. scripts/deploy.sh (bash, set -euo pipefail, chmod +x — zapisz w git: `git update-index --chmod=+x`):
   - Czyta konfigurację z scripts/deploy.env (MIKRUS_USER, MIKRUS_HOST, MIKRUS_PORT, REMOTE_DIR, APP_URL);
     dodaj scripts/deploy.env.example i wpis do .gitignore.
   - Wymaga pliku .env.production.local z NEXT_PUBLIC_POCKETBASE_URL (przerwij z czytelnym komunikatem, gdy brak).
   - Kroki: pnpm check, pnpm test, pnpm build; kopiuje public i .next/static do .next/standalone/.
   - Wysyłka: jeśli jest rsync -> `rsync -azL --delete --exclude .env.production`; jeśli brak (Git Bash
     na Windows) -> `tar -chzf - -C .next/standalone . | ssh ... "tar -xzf - -C $REMOTE_DIR.new"` i atomowa
     zamiana katalogów z przeniesieniem .env.production. Symlinki pnpm muszą być rozwiązane.
   - Zdalnie: systemctl restart spanko-web, potem healthcheck `curl -fsS $APP_URL` i `$APP_URL/pb/api/health`
     (exit 1 przy błędzie).
   - Dodaj w package.json: "deploy": "bash ./scripts/deploy.sh".

3. deploy/mikrus/:
   - Caddyfile (domena jako placeholder, gzip/zstd, handle_path /pb/* -> 127.0.0.1:8090 z flush_interval -1,
     reszta -> 127.0.0.1:3000, nagłówki bezpieczeństwa).
   - spanko-pb.service i spanko-web.service działające jako użytkownik `spanko` (nie root), z
     NoNewPrivileges=true, ProtectSystem=strict, ReadWritePaths tylko na potrzebne katalogi,
     EnvironmentFile=/opt/spanko/web/.env.production.
   - spanko-pb-backup.service + .timer (codzienna kopia pb_data, rotacja 14 dni).
   - .env.production.example: OPENROUTER_API_KEY, POCKETBASE_INTERNAL_URL=http://127.0.0.1:8090,
     POCKETBASE_SUPERUSER_EMAIL, POCKETBASE_SUPERUSER_PASSWORD, NEXT_PUBLIC_POCKETBASE_URL (tylko informacyjnie).
   - README.md: jednorazowa instalacja serwera krok po kroku (użytkownik spanko, katalogi, pobranie PocketBase,
     import pb_schema.json, Google OAuth z redirect URI https://<domena>/pb/api/oauth2-redirect, Caddy,
     włączenie usług), uwaga o IPv4/IPv6 na Mikr.usie, procedura rollbacku.

4. Zaktualizuj AGENTS.md (wersja Next 16, sekcja deploy w jednej linii odsyłająca do deploy/mikrus/README.md).

Nie wykonuj prawdziwego deployu ani połączeń SSH. Nie commituj. Uruchom `pnpm check && pnpm test && pnpm build`
i sprawdź, że .next/standalone/server.js powstał oraz że `bash -n scripts/deploy.sh` przechodzi.
```
