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
