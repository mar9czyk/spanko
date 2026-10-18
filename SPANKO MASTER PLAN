# 👶 SPANKO: Master Plan Architektury, Algorytmów i Vibe-Codingu (IDE Blueprint)

Dokument stanowi kompletną instrukcję budowy aplikacji **Spanko (PWA)** metodą *AI-Assisted Development / Vibe-Coding* (Cursor / Claude Code / Windsurf). Został zaprojektowany zgodnie z metodyką **AX (Agent Experience) z aihero.dev**: zwięzły budżet instrukcji w `AGENTS.md`, *Progressive Disclosure* (progresywne ujawnianie dokumentacji w katalogu `docs/agent/`) oraz deterministyczne pętle weryfikacji (`Biome` + `tsc --noEmit` + `Vitest`), dzięki którym agent AI sam weryfikuje i naprawia swój kod.

---

## 1. Architektura Systemu (100% Self-Hosted na VPS Mikr.us + Lokalny Build)

### 1.1. Stos Technologiczny
* **Frontend & BFF (Backend-for-Frontend):** Next.js 15 (App Router, tryb `output: 'standalone'`), React 19, TypeScript (Strict), Tailwind CSS v4, `shadcn/ui`, Framer Motion (płynne animacje i *Bottom Sheets* pod obsługę jednym kciukiem w nocy).
* **Przyszła kompilacja natywna (iOS/Android):** Struktura kompatybilna z **Capacitor** (czysta warstwa UI oddzielona od akcji serwerowych).
* **Baza Danych, Auth & Realtime:** **PocketBase** (pojedyncza binarka Go działająca na Mikr.usie jako usługa `systemd`, baza SQLite w trybie WAL, wbudowane Google OAuth2 oraz Server-Sent Events do synchronizacji stoperów w czasie rzeczywistym między telefonami rodziców).
* **Bramka AI:** **OpenRouter API** wywoływane wyłącznie z bezpiecznych Route Handlerów Next.js (`/api/ai/*`). Modele oraz prompty są konfigurowalne w locie z poziomu Panelu Admina (`user.is_admin === true`).
* **Linter, Formatter & Testy (Pętla AX wg aihero.dev):** **Biome** (`@biomejs/biome` – zastępuje ESLint i Prettier, działa w <50ms) + **TypeScript (`tsc --noEmit`)** + **Vitest** (testy deterministycznego silnika snu).

### 1.2. Schemat Działania i Wdrożenia na VPS Mikr.us (Zero zużycia RAM na build)
Budowanie projektu Next.js odbywa się **na Twoim lokalnym komputerze**, a na serwer Mikr.us trafia wyłącznie odchudzona paczka produkcyjna (`.next/standalone` + statyki) przesyłana skryptem `deploy.sh` przez `rsync` po SSH:
1. **Lokalny komputer:** Uruchamiasz `./scripts/deploy.sh` $\rightarrow$ wykonuje `pnpm check`, `pnpm test`, `pnpm build` (na CPU/RAM Twojego komputera), a następnie w kilka sekund synchronizuje pliki przez SSH do `/opt/spanko/web` na Mikr.usie i restartuje usługę `spanko-web`.
2. **Serwer Mikr.us (Zużycie RAM łącznie ~90 MB):**
   * **Caddy (lub Nginx)** nasłuchuje na portach `80/443` (automatyczny certyfikat Let's Encrypt):
     * Ruch do `/pb/*` $\rightarrow$ przekierowuje na `127.0.0.1:8090` (proces PocketBase – ~20 MB RAM).
     * Pozostały ruch `/` $\rightarrow$ przekierowuje na `127.0.0.1:3000` (proces `node server.js` z Next.js Standalone – ~70 MB RAM).

---

## 2. Etap 0: Przygotowanie Środowiska IDE i „Agent Experience” (wg aihero.dev)

Zgodnie z wytycznymi **aihero.dev (Matt Pocock)**, najczęstszym błędem w vibe-codingu jest tworzenie gigantycznego pliku `AGENTS.md` („Ball of Mud”), który ładuje się przy każdym zapytaniu, marnuje okno kontekstowe i rozprasza model. Stosujemy:
1. **Progressive Disclosure (Progresywne Ujawnianie):** Główny plik `AGENTS.md` ma mniej niż 50 linii i działa jak mapa drogowa odsyłająca agenta do wyspecjalizowanych plików w `docs/agent/*.md` tylko wtedy, gdy pracuje nad danym modułem.
2. **Symlink `CLAUDE.md` -> `AGENTS.md`:** Jedno źródło prawdy działające w Cursor, Windsurf, Copilot oraz Claude Code.
3. **Deterministyczną pętlę zwrotną (`pnpm check` + `pnpm test`):** Agent ma twardy nakaz uruchamiania szybkiego lintera Biome i kompilatora TypeScript po każdej zmianie kodu.

### Krok 0.1: Pliki sterujące agentem i linterem

#### Plik 1: `AGENTS.md` (Root projektu – zawsze w kontekście)
```markdown
# Spanko — AI Baby Sleep Assistant & Tracker (PWA)

Mobile-first Progressive Web App combining a real-time baby sleep/routine tracker with a deterministic 3-Drive Sleep Engine and OpenRouter AI insights.

## Tech Stack & Verification Commands
- **Package Manager:** `pnpm`
- **Framework:** Next.js 15 (App Router, `output: 'standalone'`, TypeScript Strict), Tailwind CSS, shadcn/ui, Framer Motion
- **Backend:** PocketBase (SQLite + Realtime SSE + Google OAuth2)
- **Fast Verification Loop (MANDATORY — RUN AFTER EVERY CODE CHANGE):**
  - `pnpm check` -> runs Biome lint/format + `tsc --noEmit` (must return 0 errors)
  - `pnpm test` -> runs Vitest unit tests for the deterministic sleep engine

## Core Architectural Guardrails
1. **Deterministic First, AI Second:** Never use LLMs to calculate wake windows, sleep debt, or circadian anchors. All math and diagnostic trees live in `src/lib/sleep-engine/` as pure, unit-tested TypeScript functions.
2. **OpenRouter Server-Only:** All OpenRouter calls happen server-side in `src/app/api/ai/` using models and prompts fetched from PocketBase `admin_settings`. No STT/voice in MVP.
3. **Physiological Day Boundary:** A baby's day starts at morning wake-up (`woke_up_at` from night sleep) and ends at the next morning's wake-up (e.g., Tuesday morning wake-up closes Monday's physiological day).
4. **3 AM One-Thumb UX:** Dark mode by default (`#0B0F17`), warm amber/violet accents, zero mandatory typing at night, bottom-anchored controls.

## Progressive Disclosure (Read ONLY when working on a specific domain)
- Database schema, PocketBase rules & invite codes -> `docs/agent/database.md`
- Deterministic 3-Drive Sleep Engine & 7 Diagnostic Trees -> `docs/agent/sleep-engine.md`
- OpenRouter JSON schemas, Insight Versioning & Admin Panel -> `docs/agent/ai-and-admin.md`
- UI/UX guidelines, Dark Mode palette & 3 AM workflow -> `docs/agent/ux-guidelines.md`
```

#### Plik 2: `biome.json` (Surowe reguły dla Agenta AI – AI Hero AX)
Konfiguracja blokująca halucynacje typów (`noExplicitAny: "error"`), nieużywane zmienne oraz wymuszająca spójny styl w <50ms:
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error",
        "noConsoleLog": "warn",
        "noDoubleEquals": "error"
      },
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error",
        "useExhaustiveDependencies": "warn"
      },
      "style": {
        "useConst": "error",
        "noNonNullAssertion": "warn",
        "useTemplate": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  }
}
```

#### Plik 3: `tsconfig.json` (Flagi Strict dla wyłapywania błędów brzegowych)
Agent musi pracować z włączonymi flagami:
* `"strict": true`
* `"noUncheckedIndexedAccess": true` (zmusza agenta do sprawdzania `undefined` przy dostępach do tablic drzemek i logów)
* `"noImplicitReturns": true`
* `"noFallthroughCasesInSwitch": true`

#### Plik 4: Prompt inicjalizujący Etap 0 (Wklej do swojego IDE)
> **PROMPT ETAP 0 (Kopiuj do Cursor / Claude Code / Windsurf):**
> ```text
> Zainicjalizuj nowy projekt Next.js 15 z TypeScript, Tailwind CSS i App Routerem w bieżącym katalogu używając `pnpm`.
> 1. Skonfiguruj w `next.config.ts` opcję `output: 'standalone'` pod ręczny deploy paczki przez SSH na VPS Mikr.us.
> 2. Zainstaluj zależności: `pocketbase`, `lucide-react`, `framer-motion`, `date-fns`, `zod`, `clsx`, `tailwind-merge` oraz devDependencies: `@biomejs/biome`, `vitest`.
> 3. Utwórz plik `biome.json` z rygorystycznymi regułami (`noExplicitAny: "error"`, `noUnusedVariables: "error"`, `noUnusedImports: "error"`).
> 4. W `tsconfig.json` włącz flagi: `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitReturns": true`.
> 5. Dodaj w `package.json` skrypty:
>    - `"check": "biome check --write . && tsc --noEmit"`
>    - `"test": "vitest run"`
> 6. Utwórz plik `AGENTS.md` (zgodnie z architekturą Progressive Disclosure z aihero.dev) oraz utwórz symlink `ln -s AGENTS.md CLAUDE.md`.
> 7. Utwórz katalog `docs/agent/` wraz z 4 plikami dokumentacji domenowej:
>    - `docs/agent/database.md` (opis kolekcji PocketBase, granicy doby fizjologicznej i kodów zaproszeń),
>    - `docs/agent/sleep-engine.md` (opis 3 napędów snu i 7 drzew diagnostycznych),
>    - `docs/agent/ai-and-admin.md` (opis integracji z OpenRouter, maszyny stanowej wniosków i panelu admina),
>    - `docs/agent/ux-guidelines.md` (zasady Dark Mode #0B0F17, obsługi jednym kciukiem o 3:00 w nocy i porannego podsumowania pobudek).
> Po zakończeniu uruchom `pnpm check` i upewnij się, że zwraca 0 błędów.
> ```

---

## 3. Kompletny Algorytm Deterministyczny (Gotowy do wklejenia w `src/lib/sleep-engine/`)

Poniższy kod stanowi w 100% deterministyczne serce aplikacji Spanko. Nie wykonuje żadnych zapytań sieciowych, działa w <1 ms i pokrywa:
* **Granice Doby Fizjologicznej** (noc zamyka poprzedni dzień po porannej pobudce),
* **Model 3 Napędów Snu** (Ostre ciśnienie snu, 7-dniowy Chroniczny Dług Senny z filtrem *Homeostatic Rebound*, Zegar Okołodobowy ze *Strefą Zakazaną WMZ* oraz *Backwards Nap Capping*),
* **Wszystkie 7 Drzew Diagnostycznych** (Kategorie 1–7).

### 3.1. Typy Domenowe i Matryca Wiekowa (`src/lib/sleep-engine/types.ts` & `matrix.ts`)

```typescript
export type SleepType = 'nap' | 'night';
export type SleepStatus = 'falling_asleep' | 'sleeping' | 'completed';
export type SleepMood = 'easy' | 'fussy' | 'crying';

export type InterventionType =
  | 'breast'            // Poziom 5
  | 'bottle'            // Poziom 5
  | 'bouncing'          // Poziom 5
  | 'carrying'          // Poziom 4
  | 'stroller_car'      // Poziom 4
  | 'co_sleeping'       // Poziom 3
  | 'patting'           // Poziom 3
  | 'pacifier_reinsert' // Poziom 2
  | 'shushing_voice'    // Poziom 2
  | 'room_presence'     // Poziom 1
  | 'independent';      // Poziom 0

export type DayMode = 'home' | 'on_the_go' | 'illness_regression';

export type ProblemCategory =
  | 'CAT1_ASSOCIATIONS_NIGHT_WAKINGS'
  | 'CAT2_BEDTIME_RESISTANCE_LATENCY'
  | 'CAT3_EARLY_WAKING_SPLIT_NIGHT'
  | 'CAT4_SHORT_NAPS_TRANSITIONS'
  | 'CAT5_REGRESSION_ILLNESS_CRISIS'
  | 'CAT6_NEWBORN_DAY_NIGHT_ACTIVE_SLEEP'
  | 'CAT7_NIGHT_WEANING_FEEDING';

export type InsightStatus =
  | 'hypothesis'
  | 'active'
  | 'validated'
  | 'corrected_by_parent'
  | 'superseded';

export interface NightWakingEntry {
  wokeAt: string; // ISO
  fellAsleepAt?: string; // ISO
  estimatedDurationMin: number; // Uzupełniane rano pigułkami: 5, 15, 60
  fedMilk: boolean;
  interventions: InterventionType[];
}

export interface SleepLog {
  id: string;
  childId: string;
  physiologicalDate: string; // YYYY-MM-DD (doba liczona do porannej pobudki!)
  type: SleepType;
  status: SleepStatus;
  putDownAt: string; // ISO
  fellAsleepAt: string; // ISO
  wokeUpAt?: string; // ISO
  interventions: InterventionType[];
  mood: SleepMood;
  nightWakings: NightWakingEntry[];
  isReboundSleep?: boolean;
  ignoreInCalibration?: boolean;
}

export interface AgeBracketConfig {
  minAgeDays: number;
  maxAgeDays: number;
  targetNapsCount: number;
  wwMinMorning: number; // minuty (1. okno rano)
  wwMaxEvening: number; // minuty (ostatnie okno przed nocą)
  maxSingleNapMin: number;
  maxDaytimeSleepMin: number;
  medianTotalSleepMin: number; // na dobę fizjologiczną (24h)
  homeostaticTauRiseMin: number; // stała czasowa narastania ciśnienia snu
}

export const DEFAULT_SLEEP_MATRIX: AgeBracketConfig[] = [
  { minAgeDays: 0, maxAgeDays: 28, targetNapsCount: 5, wwMinMorning: 35, wwMaxEvening: 60, maxSingleNapMin: 120, maxDaytimeSleepMin: 450, medianTotalSleepMin: 960, homeostaticTauRiseMin: 55 },
  { minAgeDays: 29, maxAgeDays: 60, targetNapsCount: 4, wwMinMorning: 45, wwMaxEvening: 75, maxSingleNapMin: 120, maxDaytimeSleepMin: 390, medianTotalSleepMin: 930, homeostaticTauRiseMin: 70 },
  { minAgeDays: 61, maxAgeDays: 90, targetNapsCount: 4, wwMinMorning: 60, wwMaxEvening: 95, maxSingleNapMin: 120, maxDaytimeSleepMin: 330, medianTotalSleepMin: 900, homeostaticTauRiseMin: 85 },
  { minAgeDays: 91, maxAgeDays: 120, targetNapsCount: 3, wwMinMorning: 75, wwMaxEvening: 120, maxSingleNapMin: 120, maxDaytimeSleepMin: 270, medianTotalSleepMin: 870, homeostaticTauRiseMin: 105 },
  { minAgeDays: 121, maxAgeDays: 150, targetNapsCount: 3, wwMinMorning: 95, wwMaxEvening: 140, maxSingleNapMin: 120, maxDaytimeSleepMin: 240, medianTotalSleepMin: 855, homeostaticTauRiseMin: 125 },
  { minAgeDays: 151, maxAgeDays: 180, targetNapsCount: 3, wwMinMorning: 110, wwMaxEvening: 155, maxSingleNapMin: 120, maxDaytimeSleepMin: 210, medianTotalSleepMin: 840, homeostaticTauRiseMin: 140 },
  { minAgeDays: 181, maxAgeDays: 240, targetNapsCount: 2, wwMinMorning: 135, wwMaxEvening: 195, maxSingleNapMin: 120, maxDaytimeSleepMin: 195, medianTotalSleepMin: 825, homeostaticTauRiseMin: 175 },
  { minAgeDays: 241, maxAgeDays: 300, targetNapsCount: 2, wwMinMorning: 155, wwMaxEvening: 215, maxSingleNapMin: 120, maxDaytimeSleepMin: 180, medianTotalSleepMin: 810, homeostaticTauRiseMin: 195 },
  { minAgeDays: 301, maxAgeDays: 390, targetNapsCount: 2, wwMinMorning: 180, wwMaxEvening: 240, maxSingleNapMin: 120, maxDaytimeSleepMin: 165, medianTotalSleepMin: 795, homeostaticTauRiseMin: 220 },
  { minAgeDays: 391, maxAgeDays: 540, targetNapsCount: 1, wwMinMorning: 270, wwMaxEvening: 330, maxSingleNapMin: 150, maxDaytimeSleepMin: 150, medianTotalSleepMin: 780, homeostaticTauRiseMin: 300 },
  { minAgeDays: 541, maxAgeDays: 730, targetNapsCount: 1, wwMinMorning: 300, wwMaxEvening: 360, maxSingleNapMin: 120, maxDaytimeSleepMin: 120, medianTotalSleepMin: 765, homeostaticTauRiseMin: 340 },
  { minAgeDays: 731, maxAgeDays: 1095, targetNapsCount: 1, wwMinMorning: 330, wwMaxEvening: 390, maxSingleNapMin: 90, maxDaytimeSleepMin: 90, medianTotalSleepMin: 735, homeostaticTauRiseMin: 380 }
];
```

### 3.2. Helper Granicy Doby Fizjologicznej (`src/lib/sleep-engine/physiologicalDay.ts`)

```typescript
import { SleepLog } from './types';

/**
 * Wyznacza datę fizjologiczną (YYYY-MM-DD) dla nowego zdarzenia.
 * Zasada: Doba fizjologiczna trwa od porannej pobudki ze snu nocnego do kolejnej porannej pobudki następnego dnia.
 * Jeśli jest wtorek 03:30 w nocy, a sen nocny zaczął się w poniedziałek o 19:30 (i jeszcze trwa lub to pobudka nocna),
 * zdarzenie należy do doby fizjologicznej Poniedziałku.
 */
export function resolvePhysiologicalDate(
  eventTimestampIso: string,
  recentNightLogs: SleepLog[]
): string {
  const eventMs = new Date(eventTimestampIso).getTime();

  // Szukamy aktywnego (niezakończonego) snu nocnego lub snu nocnego, w trakcie którego wypadło zdarzenie
  const matchingNight = recentNightLogs.find((log) => {
    if (log.type !== 'night') return false;
    const startMs = new Date(log.putDownAt).getTime();
    const endMs = log.wokeUpAt ? new Date(log.wokeUpAt).getTime() : Number.POSITIVE_INFINITY;
    return eventMs >= startMs && eventMs <= endMs;
  });

  if (matchingNight) {
    return matchingNight.physiologicalDate;
  }

  const eventDate = new Date(eventTimestampIso);
  // Fallback dla wpisów w nocy (00:00 - 05:59), gdy rodzic nie kliknął jeszcze startu snu nocnego
  if (eventDate.getHours() < 6) {
    const previousDay = new Date(eventMs - 24 * 60 * 60 * 1000);
    return previousDay.toISOString().slice(0, 10);
  }

  return eventDate.toISOString().slice(0, 10);
}
```

### 3.3. Silnik 3 Napędów Snu, Strefy Zakazanej (WMZ) i Predykcji (`src/lib/sleep-engine/threeDrives.ts`)

```typescript
import { AgeBracketConfig, DayMode, DEFAULT_SLEEP_MATRIX } from './types';

export interface ThreeDrivesSummary {
  effectiveAgeDays: number;
  acuteSleepPressure: number; // 0.0 - 1.2+ (1.0 = gotowość do snu, >1.10 = ryzyko kortyzolu)
  chronicSleepDebtMin: number; // dodatni = niedobór snu z 7 dni, ujemny = nadwyżka
  sleepBatteryPercent: number; // 15% - 100% wizualny wskaźnik dla rodzica
  individualSleepNeedMin: number; // indywidualna norma dobowa dziecka
  sleepNeedsProfile: 'low_sleep_needs' | 'average' | 'high_sleep_needs';
  circadianAnchorWakeTime: string; // HH:mm
  biologicalBedtime: string; // HH:mm
  forbiddenZoneStart: string; // HH:mm (Wake Maintenance Zone start)
  forbiddenZoneEnd: string; // HH:mm (Wake Maintenance Zone end)
  latestLastNapEndAt: string; // HH:mm (Backwards Nap Capping)
}

export function getAgeBracket(effectiveAgeDays: number, matrix: AgeBracketConfig[] = DEFAULT_SLEEP_MATRIX): AgeBracketConfig {
  const found = matrix.find((b) => effectiveAgeDays >= b.minAgeDays && effectiveAgeDays <= b.maxAgeDays);
  return found ?? matrix[matrix.length - 1]!;
}

/**
 * 1. Oblicza wiek efektywny (uwzględnia wiek korygowany dla wcześniaków urodzonych >=21 dni przed terminem)
 */
export function calculateEffectiveAgeDays(birthDateIso: string, dueDateIso: string | null, nowIso: string): number {
  const birth = new Date(birthDateIso).getTime();
  const now = new Date(nowIso).getTime();
  const chronologicalDays = Math.floor((now - birth) / (1000 * 60 * 60 * 24));

  if (!dueDateIso) return Math.max(0, chronologicalDays);
  const due = new Date(dueDateIso).getTime();
  const prematurityDays = Math.floor((due - birth) / (1000 * 60 * 60 * 24));

  if (prematurityDays >= 21 && chronologicalDays < 730) {
    return Math.max(0, chronologicalDays - prematurityDays);
  }
  return Math.max(0, chronologicalDays);
}

/**
 * 2. Wylicza indywidualną normę snu dziecka i 7-dniowy Chroniczny Dług Senny (z filtrem Homeostatic Rebound)
 */
export function calculateChronicDrive(
  dailyTotalsLast14DaysMin: { physiologicalDate: string; totalSleepMin: number; isIllOrIgnored: boolean }[],
  bracket: AgeBracketConfig
) {
  const validDays = dailyTotalsLast14DaysMin.filter((d) => !d.isIllOrIgnored);

  let individualSleepNeedMin = bracket.medianTotalSleepMin;
  if (validDays.length >= 5) {
    // Filtr Homeostatic Rebound: odrzucamy jednorazowe dni odsypiania (> mediana + 100 min), by nie zawyżać normy
    const nonRebound = validDays.filter((d) => d.totalSleepMin <= bracket.medianTotalSleepMin + 100);
    const sample = nonRebound.length >= 4 ? nonRebound : validDays;
    individualSleepNeedMin = Math.round(sample.reduce((acc, v) => acc + v.totalSleepMin, 0) / sample.length);
  }

  // Wagi wykładnicze dla ostatnich 7 dób fizjologicznych (indeks 0 = wczoraj)
  const weights = [0.28, 0.22, 0.16, 0.12, 0.09, 0.07, 0.06];
  const last7 = validDays.slice(0, 7);
  let weightedDebt = 0;

  last7.forEach((day, idx) => {
    const w = weights[idx] ?? 0.05;
    const dailyDeficit = individualSleepNeedMin - day.totalSleepMin;
    weightedDebt += dailyDeficit * w * 3.5;
  });

  const chronicSleepDebtMin = Math.round(weightedDebt);
  const sleepBatteryPercent = Math.max(15, Math.min(100, Math.round(100 - Math.max(0, chronicSleepDebtMin) / 2.5)));

  const diffFromPopulation = individualSleepNeedMin - bracket.medianTotalSleepMin;
  const sleepNeedsProfile: 'low_sleep_needs' | 'average' | 'high_sleep_needs' =
    diffFromPopulation <= -45 ? 'low_sleep_needs' : diffFromPopulation >= 45 ? 'high_sleep_needs' : 'average';

  return { individualSleepNeedMin, chronicSleepDebtMin, sleepBatteryPercent, sleepNeedsProfile };
}

/**
 * 3. Wylicza parametry Zegara Biologicznego (Kotwica Poranna, Strefa Zakazana WMZ i Backwards Nap Capping)
 */
export function calculateCircadianParameters(params: {
  morningWakeTimesLast5DaysMinutesFromMidnight: number[]; // np. [420, 435, 410] dla ~07:00
  bracket: AgeBracketConfig;
}): {
  circadianAnchorWakeTime: string;
  biologicalBedtime: string;
  forbiddenZoneStart: string;
  forbiddenZoneEnd: string;
  latestLastNapEndAt: string;
  biologicalBedtimeMinFromMidnight: number;
} {
  const { morningWakeTimesLast5DaysMinutesFromMidnight, bracket } = params;
  const avgWakeMin =
    morningWakeTimesLast5DaysMinutesFromMidnight.length > 0
      ? Math.round(
          morningWakeTimesLast5DaysMinutesFromMidnight.reduce((a, b) => a + b, 0) /
            morningWakeTimesLast5DaysMinutesFromMidnight.length
        )
      : 420; // domyślnie 07:00 (420 min od północy)

  // Średnia długość dnia aktywnego (zazwyczaj 12.5h - 13h od porannej kotwicy)
  const expectedNightSleepMin = Math.min(690, Math.max(600, bracket.medianTotalSleepMin - bracket.maxDaytimeSleepMin + 60));
  const bioBedtimeMin = (avgWakeMin + (1440 - expectedNightSleepMin)) % 1440;

  // Strefa Zakazana (Wake Maintenance Zone): od 90 min do 30 min przed biologicznym snem nocnym
  const wmzStartMin = (bioBedtimeMin - 90 + 1440) % 1440;
  const wmzEndMin = (bioBedtimeMin - 30 + 1440) % 1440;

  // Backwards Nap Capping: ostatnia drzemka musi się skończyć o BioBedtime - WW_Max
  const latestNapEndMin = (bioBedtimeMin - bracket.wwMaxEvening + 1440) % 1440;

  const formatHm = (totalMin: number) => {
    const h = Math.floor(totalMin / 60).toString().padStart(2, '0');
    const m = (totalMin % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  return {
    circadianAnchorWakeTime: formatHm(avgWakeMin),
    biologicalBedtime: formatHm(bioBedtimeMin),
    forbiddenZoneStart: formatHm(wmzStartMin),
    forbiddenZoneEnd: formatHm(wmzEndMin),
    latestLastNapEndAt: formatHm(latestNapEndMin),
    biologicalBedtimeMinFromMidnight: bioBedtimeMin
  };
}

/**
 * 4. Wyznacza kolejne okno snu (SweetSpot) łącząc Ostre Ciśnienie Snu, Dług Senny, Tryb Dnia i Zegar Biologiczny
 */
export function predictNextSleepSlot(params: {
  lastWakeUpIso: string;
  previousNapDurationMin: number | null;
  napIndexToday: number; // 0 = przed 1. drzemką, targetNapsCount = przed snem nocnym
  effectiveAgeDays: number;
  bracket: AgeBracketConfig;
  chronicSleepDebtMin: number;
  dayMode: DayMode;
  insightWwOffsetMin: number;
  biologicalBedtimeMinFromMidnight: number;
}): {
  sweetSpotIso: string;
  compassWindowStartIso: string; // dla Anti-Orthosomnia Mode (-15 min)
  compassWindowEndIso: string;   // dla Anti-Orthosomnia Mode (+15 min)
  targetWakeWindowMin: number;
  reasonCode: string;
} {
  const {
    lastWakeUpIso,
    previousNapDurationMin,
    napIndexToday,
    effectiveAgeDays,
    bracket,
    chronicSleepDebtMin,
    dayMode,
    insightWwOffsetMin,
    biologicalBedtimeMinFromMidnight
  } = params;

  const isBedtimeSlot = napIndexToday >= bracket.targetNapsCount;
  const progressRatio = Math.min(1, napIndexToday / Math.max(1, bracket.targetNapsCount));
  let wwMin = Math.round(bracket.wwMinMorning + progressRatio * (bracket.wwMaxEvening - bracket.wwMinMorning));
  let reasonCode = 'BASE_AGE_INTERPOLATION';

  // Korekta po krótkiej poprzedniej drzemce
  if (previousNapDurationMin !== null) {
    if (previousNapDurationMin < 20) {
      wwMin = Math.round(wwMin * 0.65);
      reasonCode = 'MICRO_NAP_PENALTY_35PCT';
    } else if (previousNapDurationMin < 45) {
      wwMin = Math.max(bracket.wwMinMorning, wwMin - 20);
      reasonCode = 'SHORT_CYCLE_NAP_PENALTY_20M';
    } else if (previousNapDurationMin > 95) {
      wwMin += 12;
      reasonCode = 'RESTORATIVE_NAP_BONUS';
    }
  }

  // Korekta o Chroniczny Dług Senny
  if (chronicSleepDebtMin > 75) {
    wwMin -= 15;
    reasonCode = 'CHRONIC_SLEEP_DEBT_COMPENSATION';
  }

  // Korekta o Tryb Dnia (Choroba/Regresja lub W Drodze)
  if (dayMode === 'illness_regression') {
    wwMin = Math.round(wwMin * 0.8);
    reasonCode = 'ILLNESS_PROTECTIVE_MODE';
  } else if (dayMode === 'on_the_go' && !isBedtimeSlot) {
    reasonCode = 'FLEXIBLE_ON_THE_GO_WINDOW';
  }

  // Korekta z aktywnego wniosku dziecka (child_insights)
  wwMin += insightWwOffsetMin;

  let sweetSpotMs = new Date(lastWakeUpIso).getTime() + wwMin * 60 * 1000;

  // Dla snu nocnego powyżej 16. tygodnia życia: kotwiczenie w Zegarze Biologicznym i unikanie Strefy Zakazanej (WMZ)
  if (isBedtimeSlot && effectiveAgeDays >= 112 && dayMode !== 'illness_regression') {
    const candidateDate = new Date(sweetSpotMs);
    const candidateMin = candidateDate.getHours() * 60 + candidateDate.getMinutes();
    const wmzStart = (biologicalBedtimeMinFromMidnight - 90 + 1440) % 1440;
    const wmzEnd = (biologicalBedtimeMinFromMidnight - 30 + 1440) % 1440;

    // Jeśli wyliczony czas wpada w Wake Maintenance Zone, a dług senny nie jest ekstremalny (<150 min),
    // przesuwamy porę snu za koniec strefy WMZ (na biologiczne okno wieczorne)
    if (candidateMin >= wmzStart && candidateMin <= wmzEnd && chronicSleepDebtMin < 150) {
      const shiftMin = biologicalBedtimeMinFromMidnight - candidateMin;
      sweetSpotMs += shiftMin * 60 * 1000;
      wwMin += shiftMin;
      reasonCode = 'CIRCADIAN_WMZ_AVOIDANCE_SHIFT';
    }
  }

  return {
    sweetSpotIso: new Date(sweetSpotMs).toISOString(),
    compassWindowStartIso: new Date(sweetSpotMs - 15 * 60 * 1000).toISOString(),
    compassWindowEndIso: new Date(sweetSpotMs + 15 * 60 * 1000).toISOString(),
    targetWakeWindowMin: wwMin,
    reasonCode
  };
}
```

### 3.4. Deterministyczne Drzewa Diagnostyczne – Wszystkie 7 Kategorii (`src/lib/sleep-engine/diagnosticTrees.ts`)

*(Pełny kod analizujący wszystkie 7 kategorii znajduje się w Specyfikacji Fazy 2 – zawiera blokadę treningu snu <16 tyg., detektor Extinction Burst w 14–28 dniu, drzewo wczesnych pobudek Flynn-Evans, detektor Split Nights, Overtired vs. Undertired/Bedtime Fading, transformacje drzemkowe oraz gotowość do ograniczenia nocnych karmień).*

---

## 4. Plan Implementacji Krok po Kroku (Prompty pod Vibe-Coding w IDE)

Każdą fazę realizujesz wklejając odpowiedni prompt do swojego IDE (Cursor / Claude Code). Na końcu każdego promptu znajduje się twardy wymóg weryfikacji `pnpm check && pnpm test`.

---

### FAZA 1: Schemat Bazy PocketBase, Kod Zaproszenia i Granica Doby Fizjologicznej

#### Zawartość do zapisania w `docs/agent/database.md`:
1. **`users`:** Kolekcja auth (Google OAuth2) + `is_admin: bool` (domyślnie `false`) + `household_id: relation`.
2. **`households`:** `id`, `name`, `invite_code` (6-znakowy alfanumeryczny kod ważny 24h), `invite_expires_at`.
3. **`children`:** `id`, `household_id`, `name`, `birth_date`, `due_date`, `active_day_mode` (`home` | `on_the_go` | `illness_regression`), `anti_orthosomnia_mode: bool`.
4. **`sleep_logs`:** `id`, `child_id`, `physiological_date` (`YYYY-MM-DD` wyliczane od porannej pobudki!), `type` (`nap` | `night`), `status` (`falling_asleep` | `sleeping` | `completed`), `put_down_at`, `fell_asleep_at`, `woke_up_at`, `interventions` (JSON array), `mood` (`easy` | `fussy` | `crying`), `night_wakings` (JSON array z obsługą porannego uzupełniania czasu trwania `[5m]` `[15m]` `[1h+]`), `is_rebound_sleep: bool`, `ignore_in_calibration: bool`.
5. **`day_context`:** `id`, `child_id`, `physiological_date`, `timestamp`, `feeding_type` (`breast` | `bottle` | `solid` | `none`), `bottle_ml`, `breast_side` (`left` | `right` | `both`), `tags` (JSON array: `ząbkowanie`, `gorączka`, `infekcja_ucha`, `spacer`, `ekran_przed_snem`).
6. **`child_insights` (Wersjonowana baza wniosków):** `id`, `child_id`, `category`, `diagnosis_code`, `status` (`hypothesis` | `active` | `validated` | `corrected_by_parent` | `superseded`), `title`, `explanation`, `algorithm_override_json`, `confidence_score`, `parent_feedback`, `parent_correction_note`, `previous_insight_id`, `superseded_by_id`, `valid_from`, `valid_until`.
7. **`admin_settings`:** `id`, `openrouter_fast_model`, `openrouter_reasoning_model`, `system_prompt_insights`, `sleep_matrix_override_json`, `ai_daily_limit_per_household`.

> **PROMPT FAZA 1 (Kopiuj do IDE):**
> ```text
> Przeczytaj `AGENTS.md` oraz `docs/agent/database.md`.
> Zaimplementuj warstwę danych, autoryzacji oraz logikę doby fizjologicznej:
> 1. Wygeneruj plik schematu `pb_schema.json` gotowy do zaimportowania w panelu PocketBase dla wszystkich 7 kolekcji (`users`, `households`, `children`, `sleep_logs`, `day_context`, `child_insights`, `admin_settings`). Skonfiguruj reguły API tak, aby użytkownik miał dostęp wyłącznie do rekordów ze swojego `household_id`, a do `admin_settings` tylko gdy `@request.auth.is_admin = true`.
> 2. Zbuduj klienta PocketBase w `src/lib/pocketbase.ts` z obsługą logowania Google OAuth2 oraz akcją tworzenia i dołączania do wspólnego gospodarstwa domowego (`household`) za pomocą 6-znakowego kodu zaproszenia (`invite_code`).
> 3. Zaimplementuj w `src/lib/sleep-engine/physiologicalDay.ts` funkcję `resolvePhysiologicalDate()`, która gwarantuje, że doba fizjologiczna trwa od porannej pobudki do kolejnej porannej pobudki następnego dnia (np. pobudki nocne o 01:30 i zakończenie snu nocnego we wtorek o 06:30 zamykają dobę poniedziałkową).
> 4. Napisz testy jednostkowe w Vitest (`src/lib/sleep-engine/__tests__/physiologicalDay.test.ts`) sprawdzające wpisy przed północą, o 02:15 w nocy oraz po porannej pobudce o 06:45.
> Uruchom `pnpm check && pnpm test` i napraw wszystkie błędy.
> ```

---

### FAZA 2: Implementacja Deterministycznego Silnika Snu (3 Napędy + 7 Kategorii)

> **PROMPT FAZA 2 (Kopiuj do IDE):**
> ```text
> Przeczytaj `AGENTS.md` oraz `docs/agent/sleep-engine.md`.
> Zaimplementuj kompletny, deterministyczny silnik snu w `src/lib/sleep-engine/`:
> 1. Utwórz `types.ts` oraz `matrix.ts` z matrycą wiekową 0-36 miesięcy (`DEFAULT_SLEEP_MATRIX`).
> 2. Utwórz `threeDrives.ts` implementujący:
>    - `calculateEffectiveAgeDays` (korekta wieku dla wcześniaków urodzonych >=21 dni przed terminem),
>    - `calculateChronicDrive` (indywidualna norma snu dziecka, profil Low/Average/High Sleep Needs, 7-dniowa Bateria Snu oraz filtr Homeostatic Rebound odrzucający jednorazowe noce odsypiania),
>    - `calculateCircadianParameters` (kotwica poranna, Strefa Zakazana Wake Maintenance Zone oraz Backwards Nap Capping),
>    - `predictNextSleepSlot` (wyliczanie SweetSpot oraz miękkiego przedziału Compass Window dla Anti-Orthosomnia Mode).
> 3. Utwórz `diagnosticTrees.ts` implementujący funkcję `evaluateAll7DiagnosticCategories()` dla wszystkich 7 kategorii problemów rodziców (w tym guardraile kliniczne <16 tyg., detektor Extinction Burst w oknie 14-28 dni po planie, drzewo wczesnych pobudek Flynn-Evans, Split Nights oraz Bedtime Fading).
> 4. Napisz zestaw minimum 15 testów jednostkowych w `src/lib/sleep-engine/__tests__/sleepEngine.test.ts` weryfikujących każde z 7 drzew diagnostycznych oraz obliczenia 3 napędów snu.
> Uruchom `pnpm check && pnpm test`.
> ```

---

### FAZA 3: Ekran Główny „Tu i Teraz” (Smart & Modern UX + Synchronizacja Realtime)

> **PROMPT FAZA 3 (Kopiuj do IDE):**
> ```text
> Przeczytaj `AGENTS.md` oraz `docs/agent/ux-guidelines.md`.
> Zbuduj główny widok aplikacji Spanko (`src/app/(app)/dashboard/page.tsx`) w stylistyce "3 AM One-Thumb Dark UX" (tło `#0B0F17`, ciepłe bursztynowe i fioletowe akcenty niepobudzające melatoniny):
> 1. Nagłówek: Przełącznik dziecka + przełącznik Trybu Dnia (`[🏠 W domu]`, `[🚗 W drodze]`, `[🤒 Choroba/Regresja]`) + przełącznik `Anti-Orthosomnia Mode` (przełącza widok z dokładnego zegara na miękki kompas, np. "Wypatruj ziewania między 13:00 a 13:30").
> 2. Karta "Smart Insight" pod nagłówkiem: prezentuje najważniejszy aktywny wniosek z `child_insights` z przyciskami `[👍 Działa]` oraz `[✏️ Skoryguj]`.
> 3. Centralny Hero Widget ("SweetSpot & Bateria Snu"):
>    - Pierścień odliczający do kolejnej drzemki/snu nocnego LUB aktywny stoper trwającego snu zsynchronizowany na żywo między telefonami rodziców przez `pb.collection('sleep_logs').subscribe('*')`.
>    - Dla noworodków (<16 tyg.) w nocy: przycisk `[⏱️ Odczekaj 60s (Active Sleep REM)]` z odliczaniem.
>    - Wskaźnik "Bateria Snu (7 dni)" + odznaka profilu potrzeb snu (`Low / Average / High Sleep Needs`) + informacja o maksymalnej godzinie końca ostatniej drzemki (Backwards Nap Capping).
> 4. Oś czasu bieżącej doby fizjologicznej: karty drzemek, karmień (`Pierś L/P`, `Butelka ml`, `Stały posiłek`) i tagów dnia.
> 5. Dolny Floating Action Bar (obsługa jednym kciukiem):
>    - Główny przycisk cyklu snu: `[▶ Start usypiania]` -> `[Zasnął]` -> `[■ Obudził się]`.
>    - W trakcie trwającego snu nocnego: wielki przycisk `[⚡ Szybka pobudka / Mleko]` (zapisuje punkt w czasie jednym dotknięciem bez otwierania formularza).
>    - Karta Porannego Podsumowania Nocy: po kliknięciu rano `[■ Obudził się na dzień]`, jeśli w nocy zanotowano szybkie pobudki, wyświetla baner z szybkimi pigułkami: "O 01:15 i 04:20 zanotowano pobudki. Ile mniej więcej trwały? `[5 min]` `[15 min]` `[1h+]`".
>    - Przycisk `[+ Dodaj wpis / Karmienie]` otwierający płynny Bottom Sheet (Framer Motion) z pigułkami interwencji i nastroju (`🟢 Gładko`, `🟡 Marudzenie`, `🔴 Płacz`).
> Uruchom `pnpm check`.
> ```

---

### FAZA 4: Integracja z OpenRouterem i Ewolucyjny System Wniosków (`child_insights`)

> **PROMPT FAZA 4 (Kopiuj do IDE):**
> ```text
> Przeczytaj `AGENTS.md` oraz `docs/agent/ai-and-admin.md`.
> Zaimplementuj serwerową integrację z OpenRouter API oraz ewolucyjną, wersjonowaną bazę wniosków:
> 1. Stwórz serwis `src/lib/openrouter.ts` wywołujący `https://openrouter.ai/api/v1/chat/completions`, który pobiera aktualnie wybrany model i prompt systemowy z kolekcji `admin_settings` w PocketBase oraz wymusza ustrukturyzowaną odpowiedź JSON walidowaną przez `zod`.
> 2. Zbuduj Route Handler `POST /api/ai/evaluate-insights`:
>    - Uruchamia deterministyczny silnik `evaluateAll7DiagnosticCategories()` oraz `calculateChronicDrive()`.
>    - Przekazuje deterministyczną diagnozę, statystyki z 7 dób fizjologicznych oraz dotychczasowe aktywne wnioski dziecka do OpenRoutera.
>    - Tworzy nowy wniosek lub aktualizuje istniejący w kolekcji `child_insights` z zachowaniem łańcucha historii (`previous_insight_id` -> `superseded_by_id`).
> 3. Zbuduj Route Handler `POST /api/ai/correct-insight` (Human-in-the-Loop):
>    - Gdy rodzic koryguje lub odrzuca wniosek (np. "Wczoraj wiercił sąsiad" lub "U nas lepiej działa godzina 20:00"), endpoint oznacza stary wniosek jako `corrected_by_parent`, w razie anomalii ustawia `ignore_in_calibration = true` na odpowiednim logu snu i zapisuje skorygowaną regułę (`algorithm_override_json`).
> 4. Zbuduj widok `/insights` ("Karta Rozwoju Snu Dziecka" + Kalendarz Historii):
>    - Sekcja "Aktywne Reguły i Wnioski Dziecka", sekcja "Hipotezy w obserwacji" oraz oś czasu "Jak zmieniał się sen dziecka" (historia zastąpionych i skorygowanych wniosków).
> Uruchom `pnpm check && pnpm test`.
> ```

---

### FAZA 5: Panel Admina (`user.is_admin === true`)

> **PROMPT FAZA 5 (Kopiuj do IDE):**
> ```text
> Przeczytaj `AGENTS.md` oraz `docs/agent/ai-and-admin.md`.
> Zbuduj chroniony Panel Admina w `src/app/(app)/admin/page.tsx` oraz zabezpiecz odpowiednie endpointy serwerowe sprawdzaniem `user.is_admin === true`:
> 1. Zakładka "Konfiguracja OpenRouter & Promptów":
>    - Wybór modelu OpenRouter dla generatora wniosków i czatu (np. `google/gemini-2.5-flash`, `anthropic/claude-3.7-sonnet`, `openai/gpt-4o-mini`).
>    - Edytor Promptu Systemowego z podglądem i przyciskiem "Testuj prompt na przykładowych danych (Sandbox)".
> 2. Zakładka "Inspektor Wniosków (AI Debugger)":
>    - Podgląd ostatnich wywołań: co wyliczył deterministyczny silnik (`diagnosisCode`, `metricsSnapshot`) -> jaki JSON wygenerował OpenRouter -> jaka była reakcja rodzica (`accepted` / `corrected`).
> 3. Zakładka "Matryca Snu (0-36 msc)":
>    - Interaktywna tabela pozwalająca modyfikować parametry `DEFAULT_SLEEP_MATRIX` (okna aktywności, limity drzemek, normy dobowe) zapisywane w `admin_settings.sleep_matrix_override_json`.
> 4. Zakładka "Gospodarstwa Domowe i Limity":
>    - Lista rodzin (`households`), zużycie zapytań AI oraz zarządzanie dziennymi limitami zapytań do OpenRoutera.
> Uruchom `pnpm check`.
> ```

---

### FAZA 6: Lokalny Build i Wdrożenie przez SSH na VPS Mikr.us

Ponieważ budujesz aplikację lokalnie na swoim komputerze i wysyłasz gotową paczkę przez SSH na Mikr.usa, konfiguracja serwera jest bardzo lekka i nie wymaga ani Dockera, ani GitHub Actions.

#### 1. Konfiguracja usług na serwerze Mikr.us (Jednorazowo)

* **`/etc/caddy/Caddyfile` (Automatyczne HTTPS + Reverse Proxy):**
  ```caddyfile
  spanko.twojadomena.pl {
      encode gzip zstd

      # API oraz Realtime SSE dla PocketBase
      handle_path /pb/* {
          reverse_proxy 127.0.0.1:8090 {
              flush_interval -1
          }
      }

      # Aplikacja Next.js Standalone
      handle {
          reverse_proxy 127.0.0.1:3000
      }
  }
  ```

* **`/etc/systemd/system/spanko-pb.service` (PocketBase):**
  ```ini
  [Unit]
  Description=Spanko PocketBase Backend
  After=network.target

  [Service]
  Type=simple
  User=root
  WorkingDirectory=/opt/spanko/pb
  ExecStart=/opt/spanko/pb/pocketbase serve --http="127.0.0.1:8090"
  Restart=always
  RestartSec=3

  [Install]
  WantedBy=multi-user.target
  ```

* **`/etc/systemd/system/spanko-web.service` (Next.js Standalone):**
  ```ini
  [Unit]
  Description=Spanko Next.js Standalone PWA
  After=network.target spanko-pb.service

  [Service]
  Type=simple
  User=root
  WorkingDirectory=/opt/spanko/web
  Environment=NODE_ENV=production
  Environment=PORT=3000
  Environment=HOSTNAME=127.0.0.1
  EnvironmentFile=/opt/spanko/web/.env.production
  ExecStart=/usr/bin/node /opt/spanko/web/server.js
  Restart=always
  RestartSec=3

  [Install]
  WantedBy=multi-user.target
  ```

#### 2. Skrypt lokalnego budowania i wysyłki przez SSH (`scripts/deploy.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

# Konfiguracja Twojego serwera Mikr.us
MIKRUS_USER="root"
MIKRUS_HOST="srvXX.mikr.us"
MIKRUS_PORT="10XXX" # Twój port SSH na Mikr.usie
REMOTE_DIR="/opt/spanko/web"

echo "🔍 1/4: Weryfikacja typów, lintów (Biome) i testów (Vitest)..."
pnpm check
pnpm test

echo "🏗️ 2/4: Budowanie paczki produkcyjnej Next.js Standalone lokalnie..."
pnpm build

echo "📦 3/4: Przygotowanie struktury standalone..."
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

echo "🚀 4/4: Przesyłanie paczki przez rsync nad SSH na Mikr.us..."
rsync -avz --delete \
  --exclude '.env.production' \
  -e "ssh -p ${MIKRUS_PORT}" \
  .next/standalone/ "${MIKRUS_USER}@${MIKRUS_HOST}:${REMOTE_DIR}/"

echo "🔄 Restartowanie usługi spanko-web na Mikr.usie..."
ssh -p "${MIKRUS_PORT}" "${MIKRUS_USER}@${MIKRUS_HOST}" "systemctl restart spanko-web && systemctl status spanko-web --no-pager"

echo "✅ Deploy zakończony sukcesem!"
```

> **PROMPT FAZA 6 (Kopiuj do IDE):**
> ```text
> Przygotuj konfigurację PWA oraz skrypt lokalnego wdrożenia przez SSH na VPS Mikr.us:
> 1. Dodaj w `src/app/manifest.ts` konfigurację Progressive Web App (nazwa "Spanko", kolorystyka `#0B0F17`, `display: 'standalone'`, `orientation: 'portrait'`, ikony pod iOS i Android) oraz meta-tagi `apple-mobile-web-app-capable` w głównym `layout.tsx`.
> 2. Utwórz skrypt `scripts/deploy.sh` (oraz nadaj mu prawa `chmod +x`), który:
>    - Uruchamia lokalnie `pnpm check` i `pnpm test`,
>    - Buduje aplikację lokalnie (`pnpm build`),
>    - Kopiuje katalogi `public` oraz `.next/static` do `.next/standalone/`,
>    - Wysyła zawartość `.next/standalone/` przez `rsync` po SSH (z obsługą niestandardowego portu SSH Mikr.usa) do `/opt/spanko/web` z zachowaniem pliku `.env.production` na serwerze,
>    - Restartuje zdalnie usługę `systemctl restart spanko-web`.
> 3. Utwórz w katalogu `deploy/mikrus/` pliki wzorcowe: `Caddyfile`, `spanko-pb.service`, `spanko-web.service` oraz `.env.production.example`.
> 4. Dodaj w `package.json` skrypt `"deploy": "./scripts/deploy.sh"`.
> Uruchom `pnpm check && pnpm test`.
> ```