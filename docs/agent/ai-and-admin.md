# Dokumentacja Domenowa: Integracja z OpenRouter, Wnioski AI i Panel Admina

Dokument opisuje architekturę bramki AI opartej na OpenRouter, wersjonowaną maszynę stanową wniosków (`child_insights`), pętlę Human-in-the-Loop oraz moduły Panelu Administratora.

---

## 1. Architektura Bramki AI (OpenRouter Server-Only)

1. **Brak kluczy AI po stronie klienta:**
   - Wywołania do OpenRouter API (`https://openrouter.ai/api/v1/chat/completions`) są dozwolone **wyłącznie** w Route Handlerach Next.js (`src/app/api/ai/*`).
   - Zmienna środowiskowa `OPENROUTER_API_KEY` istnieje wyłącznie na serwerze i nigdy nie jest przekazywana do przeglądarki (`NEXT_PUBLIC_` jest zabronione).
2. **Dynamiczna Konfiguracja w Runtime:**
   - Modele (np. szybki `google/gemini-2.5-flash` oraz zaawansowany `anthropic/claude-3.7-sonnet`) oraz bazowy prompt systemowy są pobierane w locie z kolekcji `admin_settings` w PocketBase.
   - Umożliwia to natychmiastową zmianę modelu lub promptu w Panelu Admina bez konieczności ponownego budowania i wdrażania aplikacji.
3. **Deterministyczna Walidacja Zod:**
   - Każda odpowiedź z OpenRoutera jest formatowana w JSON i rygorystycznie sprawdzana schematem Zod przed zapisem do bazy `child_insights`.
   - Brak halucynacji liczb czy godzin: wartości liczbowe pochodzą z deterministycznego silnika `src/lib/sleep-engine/`.

---

## 2. Maszyna Stanowa Wersjonowanych Wniosków (`child_insights`)

Wnioski dotyczące snu dziecka nie są statycznymi poradami, lecz dynamicznymi regułami ewoluującymi w czasie.

### 2.1. Cykl Życia Wniosku (Statusy)
```text
           ┌──────────────┐
           │  hypothesis  │  (Wstępna hipoteza, np. 2 dni z krótką drzemką)
           └──────┬───────┘
                  │
                  ▼
           ┌──────────────┐
           │    active    │  (Potwierdzony wzorzec, wyświetlany w Smart Insight)
           └──────┬───────┘
                  ├───────────────────────────────┐
                  ▼                               ▼
       ┌──────────────────────┐        ┌───────────────────────┐
       │      validated       │        │  corrected_by_parent  │ (Rodzic kliknął "Skoryguj")
       └──────────┬───────────┘        └──────────┬────────────┘
                  │                               │
                  ▼                               ▼
       ┌───────────────────────────────────────────────────────┐
       │                      superseded                       │ (Zastąpiony przez nowszy wniosek)
       └───────────────────────────────────────────────────────┘
```

### 2.2. Łańcuch Ewolucji i Odwracalność (Audit Trail)
- Każdy rekord w `child_insights` posiada powiązania:
  - `previous_insight_id` $\rightarrow$ wskazuje na wniosek, z którego ten wniosek wyewoluował.
  - `superseded_by_id` $\rightarrow$ wskazuje na nowszy wniosek, który go zastąpił.
- Umożliwia to wyświetlenie rodzicowi w widoku `/insights` pełnej osi czasu "Jak zmieniał się sen Twojego dziecka na przestrzeni miesięcy".

---

## 3. Pętla Human-in-the-Loop (Korekta Rodzica)

### 3.1. Przycisk "Skoryguj" w Karcie Smart Insight
Gdy aplikacja sugeruje wniosek (np. "Przesuńmy porę snu na 19:15 z powodu długu sennego"), rodzic ma do dyspozycji:
1. `[👍 Działa]` $\rightarrow$ status wniosku przechodzi w `validated`.
2. `[✏️ Skoryguj]` $\rightarrow$ otwiera Bottom Sheet z opcjami:
   - "To był wyjątek (hałas, podróż, wizyta dziadków)" $\rightarrow$ wywołuje `POST /api/ai/correct-insight`, który oznacza odpowiedni log snu jako `ignore_in_calibration = true`, by nie fałszował normy dziecka.
   - "Moje dziecko potrzebuje innego okna" $\rightarrow$ pozwala wpisać korektę (np. $+15$ min), która zostaje zapisana w `algorithm_override_json` i natychmiast wpływa na kalkulacje SweetSpot.

---

## 4. Architektura Panelu Administratora (`/admin`)

Dostęp do panelu administratora jest rygorystycznie chroniony warunkiem:
`user.is_admin === true` (zarówno na poziomie middleware/layout, jak i reguł PocketBase).

### 4.1. Moduły Panelu
1. **Konfiguracja OpenRouter & Promptów:**
   - Wybór modelu szybkiego (Fast Model) oraz modelu wnioskowania (Reasoning Model).
   - Edytor promptu systemowego z podglądem na żywo.
   - **Sandbox Testowy:** Uruchamianie generowania wniosków na anonimizowanych przykładowych profilach danych bez wpływu na bazę produkcyjną.
2. **Inspektor Wniosków (AI Debugger):**
   - Podgląd 3-częściowego przepływu:
     1. Dane wejściowe wyliczone przez silnik deterministyczny (`diagnosisCode`, parametry 3 napędów).
     2. Surowy JSON wygenerowany przez OpenRouter.
     3. Akcja i komentarz rodzica (`accepted`, `corrected`).
3. **Edytor Matrycy Snu (0–36 msc):**
   - Interaktywny edytor parametrów populacyjnych (`DEFAULT_SLEEP_MATRIX`).
   - Zmiany zapisywane w `admin_settings.sleep_matrix_override_json`.
4. **Gospodarstwa Domowe i Monitoring Limitów:**
   - Wykaz zarejestrowanych rodzin.
   - Licznik dziennych zapytań AI i konfiguracja `ai_daily_limit_per_household`.

## Zmienne środowiskowe serwera (endpointy `/api/ai/*`)
- `POCKETBASE_INTERNAL_URL` (opcjonalnie; domyślnie `NEXT_PUBLIC_POCKETBASE_URL`) — adres PocketBase widziany przez serwer Next.js.
- `POCKETBASE_SUPERUSER_EMAIL` / `POCKETBASE_SUPERUSER_PASSWORD` — konto superusera do odczytu `admin_settings` (reguły dopuszczają tylko admina). Bez nich używane są domyślne model/prompt i limit.
- Endpointy wymagają nagłówka `Authorization: Bearer <token PocketBase>`; token jest weryfikowany `authRefresh`, a zapytania idą klientem użytkownika (reguły API gospodarstwa). Limit dzienny (`ai_daily_limit_per_household`, domyślnie 20) liczony jako wnioski z ostatnich 24h; po przekroczeniu zwracane jest 429.

## Panel Admina (`/admin`) i API `/api/admin/*`
- Każdy handler zaczyna od `requireAdmin(request)` (`src/lib/server/auth.ts`): weryfikuje token (`authRefresh`), wymaga `is_admin === true` z rekordu serwera, NIE wymaga `household_id`. Przekierowanie nie-adminów w UI to tylko wygoda.
- Wejście walidowane zod-em (`src/lib/server/adminSchemas.ts`); schematy trzymamy poza plikami `route.ts` (Next dopuszcza tam tylko handlery).
- `settings` (GET/PUT) – modele, prompt, `sleep_matrix_override_json` (walidowana `validateSleepMatrix`), limit globalny.
- `sandbox` (POST) – silnik na przykładowych danych (`sandboxFixtures.ts`) + OpenRouter; nie tworzy `child_insights`, loguje `ai_calls` z `kind=sandbox`.
- `ai-calls` (GET) – paginowany log (silnik → JSON modelu → reakcja rodzica).
- `households` (GET/PATCH) – lista z zużyciem AI i nadpisaniem limitu (`ai_daily_limit_override`); wymaga konta serwisowego.
- Matryca z `admin_settings` jest stosowana w `evaluate-insights` przez `resolveSleepMatrix` (fallback do `DEFAULT_SLEEP_MATRIX`). Dashboard po stronie klienta używa matrycy domyślnej.
- Limit dzienny: `households.ai_daily_limit_override` > `admin_settings.ai_daily_limit_per_household` > 20; liczony z `ai_calls` (`kind=evaluate`, 24 h), a bez konta serwisowego z liczby wniosków.

## 5. Coach Celów (`POST /api/ai/goal-coach`, Faza 9)
- Idempotentny w obrębie doby fizjologicznej: zapisuje `goal_daily_tasks` (zadania, decyzja `progress_json`, `coach_json`); drugie wywołanie zwraca zapis bez kosztu AI.
- Wejście do promptu: gotowy plan z `src/lib/goals-engine/` (zadania dnia, wskazówka nocna, decyzja). AI **nie zmienia** liczb ani kroków — tylko formułuje rady (`headline`, `todayAdvice[1-3]`, `nightTip`, `encouragement`, `why`). Walidacja Zod (`GoalCoachSchema`).
- Bez klucza OpenRouter lub przy błędzie/niepoprawnym JSON: tekst deterministyczny z `src/lib/goal-copy.ts` (PL/EN); wywołanie logowane w `ai_calls` (`kind = goal_coach`) i wlicza się do dziennego limitu gospodarstwa (`src/lib/server/aiLimit.ts`).
- Prompt systemowy: `admin_settings.system_prompt_goal_coach` (brak edycji w Panelu Admina — do dodania), domyślnie `DEFAULT_GOAL_COACH_PROMPT`.
- Insighty (`evaluate-insights`) są teraz promptowane jako **praktyczna rada na dziś**, a wyjaśnienie „dlaczego” jest wtórne.
- Endpointy celów: `POST /api/goals/preview` (gotowość + plan), `POST /api/goals` (start, walidacja po stronie serwera, jeden aktywny cel na dziecko), `POST /api/goals/status` (wstrzymaj/wznów/porzuć).
