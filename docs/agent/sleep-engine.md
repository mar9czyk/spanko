# Dokumentacja Domenowa: Deterministyczny Silnik Snu (Sleep Engine)

Dokument opisuje matematyczne i fizjologiczne fundamenty silnika snu aplikacji Spanko (`src/lib/sleep-engine/`). Silnik jest w 100% deterministyczny, czysty (pure TypeScript), działa w <1 ms bez jakichkolwiek zapytań sieciowych czy wywołań LLM.

---

## 1. Złota Zasada Architektury: Determinizm Przed AI

1. **Zero LLM w obliczeniach:** Żaden model sztucznej inteligencji nie wylicza okien czuwania, długu sennego, godzin snu ani nie podejmuje decyzji diagnostycznych w czasie rzeczywistym.
2. **Czysta Funkcyjność:** Wszystkie moduły w `src/lib/sleep-engine/` są funkcjami czystymi, deterministycznymi i w 100% pokrytymi testami jednostkowymi w Vitest.
3. **Rola AI:** OpenRouter pełni wyłącznie rolę asystenta komunikacji — ubiera deterministyczne wyniki i kody diagnoz w empatyczny, bezpieczny język zaleceń dla zmęczonego rodzica.

---

## 2. Matryca Wiekowa i Wiek Korygowany (`matrix.ts`)

### 2.1. Tabela Przedziałów Wiekowych (`DEFAULT_SLEEP_MATRIX`)
Dzieci w wieku 0–36 miesięcy są podzielone na 12 przedziałów wiekowych:
- `0–28 dni`: 5 drzemek, WW 35–60m, maks. drzemka 120m, max dzień 450m, mediana doby 960m, Tau 55m.
- `29–60 dni`: 4 drzemki, WW 45–75m, maks. drzemka 120m, max dzień 390m, mediana doby 930m, Tau 70m.
- `61–90 dni`: 4 drzemki, WW 60–95m, maks. drzemka 120m, max dzień 330m, mediana doby 900m, Tau 85m.
- `91–120 dni`: 3 drzemki, WW 75–120m, maks. drzemka 120m, max dzień 270m, mediana doby 870m, Tau 105m.
- `121–150 dni`: 3 drzemki, WW 95–140m, maks. drzemka 120m, max dzień 240m, mediana doby 855m, Tau 125m.
- `151–180 dni`: 3 drzemki, WW 110–155m, maks. drzemka 120m, max dzień 210m, mediana doby 840m, Tau 140m.
- `181–240 dni`: 2 drzemki, WW 135–195m, maks. drzemka 120m, max dzień 195m, mediana doby 825m, Tau 175m.
- `241–300 dni`: 2 drzemki, WW 155–215m, maks. drzemka 120m, max dzień 180m, mediana doby 810m, Tau 195m.
- `301–390 dni`: 2 drzemki, WW 180–240m, maks. drzemka 120m, max dzień 165m, mediana doby 795m, Tau 220m.
- `391–540 dni`: 1 drzemka, WW 270–330m, maks. drzemka 150m, max dzień 150m, mediana doby 780m, Tau 300m.
- `541–730 dni`: 1 drzemka, WW 300–360m, maks. drzemka 120m, max dzień 120m, mediana doby 765m, Tau 340m.
- `731–1095 dni`: 1 drzemka, WW 330–390m, maks. drzemka 90m, max dzień 90m, mediana doby 735m, Tau 380m.

### 2.2. Wiek Korygowany Wcześniaków (`calculateEffectiveAgeDays`)
* Jeśli wcześniak urodził się co najmniej **21 dni przed planowanym terminem porodu** (`dueDate`) i ma mniej niż 24 miesiące (730 dni życia), silnik posługuje się **wiekiem korygowanym**:
  $$\text{effectiveAgeDays} = \text{chronologicalDays} - \text{prematurityDays}$$
* Zapobiega to błędnemu diagnozowaniu opóźnień w wydłużaniu okien czuwania u wcześniaków.

---

## 3. Model 3 Napędów Snu (3-Drive Sleep Model)

Silnik łączy trzy fizjologiczne wektory decydujące o gotowości dziecka do snu:

### 3.1. Napęd 1: Ostre Ciśnienie Snu (Acute Homeostatic Pressure)
- Wyznacza bazowe okno czuwania (Wake Window) interpolowane liniowo w ciągu dnia:
  $$\text{wwMin} = \text{wwMinMorning} + \text{ratio} \times (\text{wwMaxEvening} - \text{wwMinMorning})$$
- Kary i bonusy po poprzedniej drzemce:
  - `< 20 min` (mikro-drzemka, np. w samochodzie): kara $-35\%$ długości okna (`MICRO_NAP_PENALTY_35PCT`).
  - `< 45 min` (jeden cykl snu, częściowa regeneracja): kara $-20$ minut (`SHORT_CYCLE_NAP_PENALTY_20M`).
  - `> 95 min` (głęboki sen regeneracyjny): bonus $+12$ minut (`RESTORATIVE_NAP_BONUS`).

### 3.2. Napęd 2: Chroniczny Dług Senny i Bateria Snu (Chronic Sleep Debt)
- **Kalibracja Indywidualnej Normy:** Na podstawie ostatnich 14 dób fizjologicznych.
- **Filtr Homeostatic Rebound:** Noce o czasie snu $> \text{mediana} + 100 \text{ min}$ są traktowane jako jednorazowe odsypianie i odrzucane z obliczania normy, by nie zawyżać zapotrzebowania.
- **Profil Potrzeb Snu:**
  - `low_sleep_needs`: odchylenie $\le -45$ min od normy populacyjnej.
  - `high_sleep_needs`: odchylenie $\ge +45$ min od normy populacyjnej.
  - `average`: w normie.
- **7-dniowy Dług Ważony Wykładniczo:** Wagi: `[0.28, 0.22, 0.16, 0.12, 0.09, 0.07, 0.06]`.
- **Wskaźnik Baterii Snu:** Od 15% do 100%, informujący rodzica o zapasie energii i ryzyku wyrzutu kortyzolu.
- **Stan wyspania (`resolveSleepRestedness`):** dług $\le 75$ min → `rested`, $76$–$149$ min → `slightly_tired` (aktywna kompensacja okna), $\ge 150$ min → `very_tired` (wyłączone omijanie WMZ). Dashboard pokazuje słowo zamiast procentu.
- Jeśli dług $> 75$ min $\rightarrow$ przyspieszenie okna o 15 minut (`CHRONIC_SLEEP_DEBT_COMPENSATION`).

### 3.3. Napęd 3: Zegar Okołodobowy i Strefa Zakazana (Circadian Drive & WMZ)
- **Kotwica Poranna:** Średnia godzina pobudki z ostatnich 5 dób fizjologicznych.
- **Biologiczna Pora Snu Nocnego (`biologicalBedtime`):** Kotwica poranna $+$ czas czuwania dobowego.
- **Strefa Zakazana (Wake Maintenance Zone - WMZ):** Okno od **90 min do 30 min przed biologicznym snem nocnym**. W tym czasie szyszynka jeszcze nie produkuje melatoniny, a organizm ma najwyższą dobową czujność. Próba uśpienia dziecka w WMZ kończy się 45-minutowym oporem i płaczem.
- **Unikanie WMZ (`CIRCADIAN_WMZ_AVOIDANCE_SHIFT`):** Jeśli SweetSpot wypada w WMZ (u dzieci $\ge 16$ tyg.), silnik przesuwa porę zasypiania za koniec strefy WMZ na porę biologiczną.
- **Backwards Nap Capping:** Ostatnia drzemka dnia **musi** zakończyć się najpóźniej na:
  $$\text{latestLastNapEndAt} = \text{biologicalBedtime} - \text{wwMaxEvening}$$
  aby ciśnienie homeostatyczne zdążyło narosnąć przed nocą.

---

## 4. Tryby Dnia (Day Modes)

- **`home` (Standardowy):** Pełne egzekwowanie matrycy, strefy WMZ i Backwards Nap Capping.
- **`on_the_go` (W drodze):** Złagodzone reguły dla podróży, spacerów i wyjazdów; brak kar za drzemki w wózku.
- **`illness_regression` (Choroba / Kryzys):** Skrócenie okien czuwania o 20%, zawieszenie restrykcji WMZ i priorytet dla regeneracji organizmu dziecka.

---

## 5. 7 Deterministycznych Drzew Diagnostycznych

Wszystkie wpisy snu i parametry dobowe podlegają analizie przez 7 równoległych, w 100% deterministycznych drzew diagnostycznych. Moduł nie korzysta z LLM — generuje ustandaryzowane kody diagnoz (`diagnosisCode`), stopnie istotności (`severity`), wskaźniki pewności (`confidenceScore`) oraz nadpisania algorytmiczne (`algorithmOverride`), które OpenRouter ubiera w empatyczny język w bazie `child_insights`.

### 5.0. Powtarzalność, okno i strefa czasowa (od poprawek z raportu `badania/reports/Ocena silnika snu Spanko.md`)
- Drzewa analizują tylko logi z ostatnich 14 dni przed `nowIso` (`selectLogsInDiagnosticWindow`); nie czytają `Date.now()`.
- Godziny (wczesne pobudki, WMZ, kotwica poranna) liczone w strefie dziecka (`child.timezone`, domyślnie `Europe/Warsaw`) przez `getMinutesFromMidnightInTimeZone`.
- Wzorce wymagają powtórzeń z ostatnich 7 nocy: CAT1 ≥3 pobudki przez ≥5 nocy i wiek ≥112 dni; CAT3 Split Night i wczesna pobudka w ≥3 nocach; CAT7 ≥2 karmienia mlekiem w ≥3 nocach.
- CAT2: brak zapisanego nastroju to brak danych (`LONG_LATENCY_MOOD_UNKNOWN`, nieaktywna), a nie „spokojnie”.
- Kolejność diagnoz: istotność, pewność, kolejność kategorii; pierwsza jest główną. Nowa diagnoza problemu to `hypothesis`, powtórzona — `active`.

### 5.1. Sygnatura Wejścia i Wyjścia Orkiestratora

Ewaluacja wszystkich 7 kategorii odbywa się za pomocą czystej funkcji:
```typescript
export function evaluateAll7DiagnosticCategories(
  input: DiagnosticEvaluationInput
): readonly DiagnosticTreeResult[]
```

#### Wejście (`DiagnosticEvaluationInput`):
- `child`: kontekst dziecka (`birthDateIso`, opcjonalna `dueDateIso`, `activeDayMode`, `currentPlanStartDateIso`).
- `todayContext`: bieżący stan (`tags`: np. `ząbkowanie`, `gorączka`, `infekcja_ucha`, `dayMode`).
- `recentSleepLogs`: tablica ostatnich rekordów snu (`SleepLog[]`).
- `dailyTotalsLast14DaysMin`: sumaryczne czasy snu z ostatnich 14 dób fizjologicznych.
- `currentMetrics`: wyliczone parametry 3 Napędów Snu (`effectiveAgeDays`, `chronicSleepDebtMin`, `sleepBatteryPercent`, `sleepNeedsProfile`, `biologicalBedtimeMinFromMidnight`).

#### Wyjście (`readonly DiagnosticTreeResult[]`):
Dla każdego z 7 drzew generowany jest obiekt:
- `category`: identyfikator kategorii (`ProblemCategory`)
- `diagnosisCode`: znormalizowany kod diagnozy (`string`)
- `severity`: poziom istotności (`low` | `medium` | `high` | `info`)
- `confidenceScore`: wskaźnik pewności (od `0.0` do `1.0`)
- `isTriggered`: flaga aktywacji diagnozy (`true` = problem wymagający uwagi)
- `title`: tytuł diagnozy w języku polskim
- `explanation`: medyczne wyjaśnienie mechanizmu
- `clinicalAction`: bezpośrednia rekomendacja behawioralna dla rodzica
- `algorithmOverride`: opcjonalne nadpisanie parametrów (`wakeWindowOffsetMinutes`, `bedtimeFadingMinutes`, `recommendedDayMode`, `maxDaytimeSleepCapMinutes`)

---

### 5.2. Szczegółowe Reguły i Deterministyczne Progi 7 Drzew

#### CAT1: `CAT1_ASSOCIATIONS_NIGHT_WAKINGS` (Skojarzenia ze snem i pobudki nocne)
- **Cel:** Identyfikacja nieumiejętności samodzielnego łączenia cykli snu i zależności od wysokich poziomów drabiny interwencji.
- **Progi liczbowe:**
  - Wiek efektywny $\ge 112$ dni ($\ge 16$ tyg. życia).
  - Średnia liczba wybudzeń nocnych $\ge 3$ na noc.
  - $\ge 50\%$ nocnych interwencji stanowi poziom 4–5 (`breast`, `bottle`, `bouncing`, `carrying`).
- **Kod diagnozy:** `HIGH_INTERVENTION_SLEEP_ASSOCIATION` (`severity: "high"`, `confidence: 0.85`, `isTriggered: true`).
- **Stan normy:** `HEALTHY_SLEEP_CONSOLIDATION` (`severity: "info"`, `confidence: 0.90`, `isTriggered: false`).

#### CAT2: `CAT2_BEDTIME_RESISTANCE_LATENCY` (Opór przed snem i długa latencja)
- **Cel:** Różnicowanie trudności z zasypianiem wieczornym między przemęczeniem (kortyzol) a niedomęczeniem / próbą uśpienia w Strefie Zakazanej (WMZ).
- **Progi liczbowe:**
  - Latencja zasypiania: $\text{latency} = \text{fellAsleepAt} - \text{putDownAt} > 30$ minut.
- **Kody diagnoz:**
  - `OVERTIRED_CORTISOL_SPIKE` (`severity: "medium"`, `confidence: 0.80`, `isTriggered: true`):
    - Warunek: `latency > 30 min` ORAZ (`mood === 'crying'` LUB ostatnie okno czuwania $> \text{wwMaxEvening}$ LUB chroniczny dług senny $> 45$ min).
    - Działanie: `algorithmOverride: { wakeWindowOffsetMinutes: -20 }` (przyspieszenie pory snu o 20 min).
  - `UNDERTIRED_WMZ_CONFLICT` (`severity: "medium"`, `confidence: 0.85`, `isTriggered: true`):
    - Warunek: `latency > 30 min` ORAZ (`mood === 'easy'` LUB pora odłożenia przypada w oknie WMZ: 90–30 min przed `biologicalBedtime`).
    - Działanie: Technika *Bedtime Fading* (`algorithmOverride: { bedtimeFadingMinutes: 20 }` — opóźnienie pory położenia o 20 min do czasu skrócenia latencji $< 15$ min, a następnie stopniowe cofanie).
  - `OPTIMAL_BEDTIME_LATENCY` (`severity: "info"`, `confidence: 0.90`, `isTriggered: false`): latencja $\le 30$ min.

#### CAT3: `CAT3_EARLY_WAKING_SPLIT_NIGHT` (Wczesne pobudki poranne i Split Nights)
- **Cel:** Diagnoza wybudzeń o świcie wg drzewa Flynn-Evans oraz wielogodzinnych przerw w śnie nocnym (Split Nights).
- **Progi liczbowe:**
  - Wczesna pobudka poranna: ostateczna pobudka między `04:00` a `05:30`.
  - Split Night: nocna przerwa w śnie $\ge 60$ minut z dobrym humorem (`mood === 'easy'`) przy nadmiarze snu dziennego ($> \text{maxDaytimeSleepMin}$).
- **Kody diagnoz:**
  - `SPLIT_NIGHT_EXCESS_DAY_SLEEP` (`severity: "high"`, `confidence: 0.90`, `isTriggered: true`):
    - Działanie: `algorithmOverride: { maxDaytimeSleepCapMinutes: -30 }` (cięcie łącznego czasu drzemek w dzień o 30 min i wydłużenie ostatniego okna).
  - `EARLY_MORNING_WAKING_PHASE_ADVANCE` (`severity: "medium"`, `confidence: 0.80`, `isTriggered: true`):
    - Warunek: pobudka między `04:00` a `05:30` w drzewie Flynn-Evans (brak długu sennego, wyprzedzenie fazy rytmu okołodobowego).
    - Działanie: Opóźnienie wieczornego snu o 15–20 min i montaż rolet zaciemniających (blackout).
  - `NORMAL_CIRCADIAN_WAKE` (`severity: "info"`, `confidence: 0.90`, `isTriggered: false`): pobudka po godzinie `06:00`.

#### CAT4: `CAT4_SHORT_NAPS_TRANSITIONS` (Krótkie drzemki i przejścia drzemkowe)
- **Cel:** Ocena konsolidacji drzemek oraz gotowości do redukcji liczby drzemek (np. 3->2 lub 2->1).
- **Progi liczbowe:**
  - Krótka drzemka (pojedynczy cykl): średnia długość drzemek $< 45$ minut przez $\ge 3$ kolejne doby.
  - Okno redukcji drzemki: wiek w przedziale redukcji połączony z oporem przed ostatnią drzemką przez $\ge 5$ dni lub wydłużonymi oknami czuwania.
- **Kody diagnoz:**
  - `SINGLE_CYCLE_SHORT_NAPS` (`severity: "medium"`, `confidence: 0.80`, `isTriggered: true`):
    - Warunek: wiek $\ge 180$ dni i średnia drzemek $< 45$ min przez $\ge 3$ dni (trudność z łączeniem cykli w dzień).
    - Działanie: Technika Wake-to-Sleep lub delikatna asysta w 35. minucie drzemki; wydłużenie okna przed drzemką o 10 min.
  - `NAP_TRANSITION_READY` (`severity: "medium"`, `confidence: 0.85`, `isTriggered: true`):
    - Warunek: wiek w oknie redukcji drzemek + stały opór przed ostatnią drzemką lub opóźnianie nocy.
    - Działanie: Eliminacja ostatniej drzemki i tymczasowe przyspieszenie snu nocnego o 30 minut.
  - `DEVELOPMENTAL_SHORT_NAPS` (`severity: "info"`, `confidence: 0.85`, `isTriggered: true`): wiek $< 180$ dni i drzemki 30–45 min — w pełni fizjologiczna norma.
  - `NAP_STRUCTURE_STABLE` (`severity: "info"`, `confidence: 0.90`, `isTriggered: false`): prawidłowa długość drzemek.

#### CAT5: `CAT5_REGRESSION_ILLNESS_CRISIS` (Regresje, kryzysy i skoki rozwojowe)
- **Cel:** Wykrywanie ostrych zaburzeń snu: regresji 4. miesiąca, efektu Extinction Burst i dolegliwości chorobowych/ząbkowania.
- **Progi liczbowe:**
  - Regresja 4. miesiąca: wiek efektywny `105–135 dni` ORAZ nagły wzrost pobudek nocnych $\ge 3$/noc.
  - Extinction Burst: nagły wzrost protestów w oknie `14–28 dni` po wdrożeniu planu naprawczego (`currentPlanStartDateIso`).
  - Infekcja / Ból: tagi `gorączka`, `ząbkowanie`, `infekcja_ucha` lub `activeDayMode === 'illness_regression'`.
- **Kody diagnoz:**
  - `FOUR_MONTH_SLEEP_REGRESSION` (`severity: "high"`, `confidence: 0.85`, `isTriggered: true`):
    - Mechanizm: Dojrzewanie 4-fazowej architektury snu NREM/REM.
    - Działanie: Stała sekwencja wyciszenia, ochrona przed przemęczeniem, unikanie tworzenia nowych silnych asocjacji.
  - `EXTINCTION_BURST` (`severity: "high"`, `confidence: 0.90`, `isTriggered: true`):
    - Mechanizm: Fizjologiczny szczyt protestu układu nerwowego w 14–28 dniu wygaszania starych nawyków.
    - Działanie: Żelazna konsekwencja — protest wygasa w ciągu 48–72 godzin.
  - `ACUTE_ILLNESS_OR_TEETHING_DISRUPTION` (`severity: "medium"`, `confidence: 0.95`, `isTriggered: true`):
    - Działanie: `algorithmOverride: { recommendedDayMode: 'illness_regression' }` — skrócenie okien czuwania o 20%, zawieszenie nauki samodzielności.
  - `STABLE_DEVELOPMENT` (`severity: "info"`, `confidence: 0.90`, `isTriggered: false`): brak cech kryzysu.

#### CAT6: `CAT6_NEWBORN_DAY_NIGHT_ACTIVE_SLEEP` (Noworodek: Ochrona kliniczna, sen aktywny i odwrócenie nocy z dniem)
- **Cel:** Ochrona noworodków, egzekwowanie reguły pauzy 60s w fazie REM oraz diagnoza odwrócenia rytmu dobowego.
- **Progi liczbowe:**
  - Wiek noworodkowy: wiek efektywny $< 112$ dni ($< 16$ tygodni życia).
  - Odwrócenie nocy z dniem: suma snu dziennego $>$ suma snu nocnego w dobie fizjologicznej.
- **Kody diagnoz:**
  - `NEWBORN_ACTIVE_SLEEP_GUARDRAIL` (`severity: "high"`, `confidence: 1.0`, `isTriggered: true`):
    - Bezwzględny guardrail kliniczny: zakaz jakichkolwiek treningów wypłakiwania (Cry-It-Out).
    - Zalecenie: Reguła pauzy 60 sekund w fazie snu aktywnego REM przed interwencją.
  - `DAY_NIGHT_CONFUSION` (`severity: "high"`, `confidence: 0.85`, `isTriggered: true`):
    - Warunek: sen dzienny $>$ sen nocny.
    - Działanie: Światło i odgłosy życia w dzień, ciemność i cisza w nocy, limit pojedynczej drzemki do 120 minut.
  - `MATURE_CIRCADIAN_RHYTHM` (`severity: "info"`, `confidence: 0.95`, `isTriggered: false`): wiek $\ge 112$ dni.

#### CAT7: `CAT7_NIGHT_WEANING_FEEDING` (Ograniczanie karmień nocnych)
- **Cel:** Różnicowanie fizjologicznego głodu kalorycznego od nawykowego ssania dla uspokojenia (Comfort Nursing) u dzieci powyżej 6. miesiąca życia.
- **Progi liczbowe:**
  - Wiek minimalny: wiek efektywny $\ge 180$ dni ($\ge 6$ miesięcy życia).
  - Częstotliwość karmień nocnych: $\ge 2$ karmienia nocne mimo pełnych, sycących posiłków w dzień.
- **Kody diagnoz:**
  - `HABITUAL_NIGHT_FEEDING_ASSOCIATION` (`severity: "medium"`, `confidence: 0.85`, `isTriggered: true`):
    - Warunek: wiek $\ge 180$ dni oraz $\ge 2$ wybudzenia na karmienie w nocy o charakterze uspokajającym (krótkie ssanie $< 5$ min lub butelka $< 30$ ml).
    - Działanie: Stopniowe skracanie czasu karmień o 1–2 minuty co 2 noce, uspokajanie przez drugiego rodzica lub podanie smoczka/wody.
  - `NUTRITIONAL_NIGHT_HUNGER` (`severity: "info"`, `confidence: 0.95`, `isTriggered: false`):
    - Wiek $< 180$ dni lub realny głód kaloryczny — karmienie na żądanie.
  - `BALANCED_NIGHT_NUTRITION` (`severity: "info"`, `confidence: 0.90`, `isTriggered: false`): zrównoważony rytm nocnego odżywiania.

