# Dokumentacja Domenowa: Deterministyczny Silnik Snu (Sleep Engine)

Dokument opisuje silnik snu Spanko (`src/lib/sleep-engine/`) w stanie po etapach A–E planu poprawy (PR #11–#15). Silnik jest deterministyczny i czysty (pure TypeScript): bez zapytań sieciowych, bez LLM i bez `Date.now()` (czas odniesienia `nowIso` jest wstrzykiwany).

**Poziom dowodu.** Przy liczbach podajemy w nawiasie kwadratowym poziom dowodu z [`zrodla.md`](zrodla.md): **[B]** badanie, **[W]** wytyczna, **[E]** opinia ekspercka lub praktyka kliniczna, **[H]** heurystyka Spanko (stała autorska albo ze specyfikacji Spanko v2.0). W kodzie stałe bez źródła mają komentarz `// heurystyka`. Liczby [E] i [H] to punkt startowy prognozy, nie fakt fizjologiczny, i tak też mają być opisywane rodzicom.

---

## 1. Złota zasada: determinizm przed AI

1. **Zero LLM w obliczeniach.** Okna czuwania, dług, pora snu, diagnozy i korekty prognozy liczy wyłącznie kod.
2. **Czyste funkcje** w `src/lib/sleep-engine/`, pokryte testami Vitest (`__tests__/`).
3. **Rola AI.** OpenRouter tylko ubiera wynik drzew w język dla rodzica (`title`, `explanation`). Kategoria, kod diagnozy, status, pewność i nadpisania pochodzą z drzew. Wartość `wwOffsetMin` wpisana przez model nigdy nie zmienia prognozy (`insightOverride.ts`, szczegóły w `ai-and-admin.md`).

---

## 2. Matryca wiekowa i wiek skorygowany (`matrix.ts`)

### 2.1. Przedziały (`DEFAULT_SLEEP_MATRIX`)
13 przedziałów 0–1095 dni. Kolumny: drzemki (zakres `minNapsCount`–`targetNapsCount`), okno czuwania rano–wieczorem (WW), maks. pojedyncza drzemka, maks. sen dzienny, mediana doby, τ, średnia i górna norma pobudek nocnych.

| Dni | Drzemki | WW (min) | Maks. drzemka / dzień | Mediana doby | τ | Pobudki śr. / górna |
|---|---|---|---|---|---|---|
| 0–28 | 3–5 | 35–60 | 120 / 450 | 960 | 55 | 1,7 / 3,4 |
| 29–60 | 3–4 | 45–75 | 120 / 390 | 930 | 70 | 1,7 / 3,4 |
| 61–90 | 3–4 | 60–95 | 120 / 330 | 900 | 85 | 2,2 / 3,4 |
| 91–120 | 3 | 75–120 | 120 / 270 | 870 | 105 | 2,2 / 3,4 |
| 121–150 | 2–3 | 95–140 | 120 / 240 | 855 | 125 | 2,2 / 3,0 |
| 151–180 | 2–3 | 110–155 | 120 / 210 | 840 | 140 | 2,3 / 3,0 |
| 181–240 | 2 | 135–195 | 120 / 195 | 825 | 175 | 2,4 / 3,0 |
| 241–300 | 2 | 155–215 | 120 / 180 | 810 | 195 | 2,4 / 3,0 |
| 301–390 | 2 | 180–240 | 120 / 165 | 795 | 220 | 1,8 / 2,5 |
| 391–450 | 1–2 | 180–240 | 120 / 165 | 780 | 220 | 1,4 / 2,5 |
| 451–540 | 1 | 270–330 | 150 / 150 | 780 | 300 | 1,1 / 2,5 |
| 541–730 | 1 | 300–360 | 150 / 150 | 765 | 340 | 0,9 / 2,5 |
| 731–1095 | 0–1 | 330–390 | 150 / 150 | 735 | 380 | 0,9 / 2,5 |

Poziom dowodu kolumn:
- **Mediana doby** [W/B]: w zakresach WHO 2019 i AASM 2016 (Paruthi), blisko średnich Galland 2012. To kotwica populacyjna, nigdy cel pokazywany rodzicowi (±2 SD to ok. 4–6 h).
- **Liczba drzemek** [B]: Galland 2012 (noworodek ok. 3,1 drzemki, zakres 1,2–5), Mindell 2016 (2 drzemki już w 3.–7. mies.), Paavonen 2020 (2 drzemki u ok. 72% w 8. mies.), Iglowstein 2003 (2→1 ok. 13–18 mies., ok. połowa 3-latków bez drzemki).
- **Okna czuwania** [E]: opinia ekspercka (Flynn-Evans, Canapari); żadne badanie ich nie walidowało. Arytmetycznie spójne z sumami snu i liczbą drzemek.
- **Limity drzemek** [H]: miękka sugestia, nie twardy limit. Długość drzemek rośnie do 28. mies. (Mindell 2016), więc nie ma już limitu 90 min u 2–3-latka.
- **Pobudki nocne** [B]: Galland 2012 (0–3,4 w 0–2 mies., 0–2,5 w 1–2 r.ż.), średnie z Paavonen 2020; wartości pośrednie interpolowane. Kontekst dla CAT1.
- **τ (`homeostaticTauRiseMin`)** [H]: stała autorska Spanko.

### 2.2. Liczba drzemek dopasowana do dziecka (`applyObservedNapsCount`)
Gdy przedział dopuszcza zakres (`minNapsCount < targetNapsCount`) i w ≥5 z ostatnich 7 pełnych dób (`NAP_TRANSITION_MIN_DAYS`, `NAP_TRANSITION_SAMPLE_DAYS`) dziecko miało najwyżej `minNapsCount` drzemek, silnik planuje dzień na tę mniejszą liczbę [H, spec v2.0]. Obejmuje to 3→2 od 121. dnia (Mindell 2016), 2→1 od 391. dnia i dzień bez drzemki w 3. roku. W trybie bez drzemki `maxDaytimeSleepMin` = 0. Bez danych matryca zostaje bez zmian.

### 2.3. Wiek skorygowany (`calculateEffectiveAgeDays`, `threeDrives.ts`)
- Korekta, gdy poród był **ponad 21 dni** przed terminem (`PREMATURITY_THRESHOLD_DAYS = 21`, warunek `>`), czyli przed 37+0 tc., i dziecko ma mniej niż 730 dni [W: NICE NG72, AAP]. Dziecko z 37+0 jest donoszone i nie ma korekty.
  $$\text{effectiveAgeDays} = \text{chronologicalDays} - \text{prematurityDays}$$
- Wiek skorygowany obowiązuje w całym silniku: matryca, drzewa, bramki celów i metod, bezpieczny sen.

---

## 3. Model trzech napędów (`threeDrives.ts`)

Model dwuprocesowy (presja homeostatyczna + zegar dobowy) ma oparcie w badaniach [B: Jenni 2004, Fattinger 2014, Joseph 2015]. Konkretne liczby niżej to głównie [H].

### 3.1. Napęd 1: presja homeostatyczna (okno czuwania)
- Bazowe okno interpolowane liniowo w ciągu dnia: $\text{base} = \text{wwMinMorning} + \text{ratio} \times (\text{wwMaxEvening} - \text{wwMinMorning})$, gdzie `ratio = napIndexToday / targetNapsCount` [E: gradient „krótsze rano” z praktyki].
- Korekty po poprzedniej drzemce — kierunek zgodny z Lassonde 2016 [B], wartości [H]:
  - `< 20 min`: okno × 0,65 (`MICRO_NAP_PENALTY_35PCT`),
  - `< 45 min`: −20 min, nie mniej niż `wwMinMorning` (`SHORT_CYCLE_NAP_PENALTY_20M`),
  - `> 95 min`: +12 min (`RESTORATIVE_NAP_BONUS`).
- Dług > 75 min: okno −15 min (`CHRONIC_SLEEP_DEBT_COMPENSATION`) [H].
- Tryb choroby: okno × 0,8 (`ILLNESS_PROTECTIVE_MODE`) [H].
- Przesunięcie z wniosku (`insightWwOffsetMin`) dodawane na końcu, ograniczone do ±30 min (`MAX_INSIGHT_WW_OFFSET_MINUTES`).
- Dzień bez drzemki (`targetNapsCount = 0`): okno od pobudki do przewidywanej pory snu, nie krótsze niż `wwMaxEvening` (`NO_NAP_DAY_BEDTIME`).

### 3.2. Napęd 2: dług snu i wyspanie (`calculateChronicDrive`)
- **Norma indywidualna**: mediana sumy doby z ≥7 pełnych dób (`MIN_CALIBRATION_DAYS`; 7 nocy jak w badaniach aktygraficznych, Sadeh 1995 [B]). Przy mniejszej liczbie dób — mediana populacyjna z matrycy. Doby chorobowe i oznaczone jako pominięte (`isIllOrIgnored`) nie wchodzą do obliczeń.
- **Filtr odsypiania** [H, spec v2.0]: doba nie wchodzi do normy, gdy dług przed nią > 120 min i noc była dłuższa od wstępnej normy nocy o > 90 min albo drzemka trwała > 150 min. Jeśli po filtrze zostanie < 5 dób, norma to wstępna mediana.
- **Profil potrzeb snu**: `low_sleep_needs` / `high_sleep_needs`, gdy norma odbiega od mediany populacyjnej o ≥1 SD: 90 min u niemowląt, 60 min od 365. dnia [B: Galland 2012]. W pozostałych przypadkach `average`.
- **Dług** [H]: ważona średnia niedoboru względem własnej normy z 3 ostatnich pełnych dób, wagi `[0.5, 0.3, 0.2]` (`CHRONIC_DEBT_WEIGHTS`). Krótki horyzont, bo kompensacja następuje w ok. 24 h [B: Lassonde 2016]. Ujemny dług oznacza nadwyżkę. Mnożnik ×3,5 został usunięty w etapie B.
- **Wyspanie** (`resolveSleepRestedness`) [H]: dług ≤ 75 min → `rested`, 76–149 min → `slightly_tired` (okna −15 min), ≥ 150 min → `very_tired` (wyłączone omijanie WMZ). UI pokazuje to jako „wyspanie względem zwykłego rytmu”, orientacyjny wskaźnik (decyzja 3 Gosi). Pole `sleepBatteryPercent` (15–100%, dług / 2,5) zostaje dla zgodności, ale UI nie pokazuje procentu.

### 3.3. Napęd 3: rytm dobowy i WMZ (`calculateCircadianParameters`)
- **Kotwica poranna**: średnia pora pobudki z 5 ostatnich nocy w strefie dziecka (`child.timezone`, domyślnie `Europe/Warsaw`); bez danych 07:00.
- **Przewidywana pora snu nocnego** (`biologicalBedtime`, w UI „przewidywana pora snu”) [H]:
  - wzór: pobudka + (24 h − oczekiwany sen nocny), gdzie sen nocny = mediana doby − maks. sen dzienny + 60 min, w granicach 600–690 min,
  - pół na pół z faktyczną porą zaśnięcia z 5 nocy (`OBSERVED_BEDTIME_WEIGHT = 0.5`, co najmniej 3 obserwacje, odchylenie do ±120 min), bo pora kładzenia najlepiej przewiduje fazę melatoniny [B: Akacem 2016, LeBourgeois 2013],
  - plus przesunięcie z drzew (bedtime fading, wczesne pobudki) ograniczone do ±30 min.
- **WMZ** [H; istnienie strefy: Giganti 2001 [B]]: od 90 do 30 min przed przewidywaną porą snu. Jeśli prognozowany sen nocny wypada w WMZ, silnik przesuwa go na przewidywaną porę snu (`CIRCADIAN_WMZ_AVOIDANCE_SHIFT`). Omijanie wyłączone przy długu ≥ 150 min.
- **Rampa rytmu dobowego** [B: Joseph 2015, Kennaway 1996; start wg spec v2.0]: waga 0 do 70. dnia (10 tyg.), liniowo do 1 w 112. dniu (16 tyg.) (`resolveCircadianWeight`). Przesunięcie WMZ jest mnożone przez tę wagę.
- **Górna granica pory snu** [H, spec v2.0]: od 16 tyg. sen nocny wypada najwyżej 30 min po przewidywanej porze (`CIRCADIAN_BEDTIME_LATE_CAP`), o ile okno nie spadnie poniżej porannego minimum.
- **Koniec ostatniej drzemki** (`latestLastNapEndAt`) [H; kierunek: Nakagawa 2016 [B]]: przewidywana pora snu − `wwMaxEvening` + korekta limitu snu dziennego (do −60 min).
- Korekty rytmu nie działają w trybie choroby, w dniu bez drzemki i przy prognozie drzemki dziennej.

### 3.4. Prognoza (`predictNextSleepSlot`) i sugestia pobudki (`suggestNapWakeTime`)
- SweetSpot = ostatnia pobudka + okno (3.1) + korekta dobowa (3.3). Compass Window = SweetSpot ±15 min [H].
- `reasonCode` mówi, która reguła zadziałała ostatnia (np. `BASE_AGE_INTERPOLATION`, `MICRO_NAP_PENALTY_35PCT`, `CHRONIC_SLEEP_DEBT_COMPENSATION`, `ILLNESS_PROTECTIVE_MODE`, `CIRCADIAN_WMZ_AVOIDANCE_SHIFT`, `CIRCADIAN_BEDTIME_LATE_CAP`, `NO_NAP_DAY_BEDTIME`).
- `suggestNapWakeTime`: tylko gdy aktywny wniosek zaleca skrócenie snu dziennego. Limit dnia = `maxDaytimeSleepMin` + korekta drzewa (do −60 min); pojedyncza drzemka 30 min – `maxSingleNapMin`. To miękka sugestia, nie alarm.

### 3.5. Skąd prognoza bierze korekty z drzew (`insightOverride.ts`)
- `resolveInsightWwOffset`: `wakeWindowOffsetMinutes` z drzew; `wwOffsetMin` tylko z korekty rodzica (`corrected_by_parent`). Zakres ±30 min.
- `resolveInsightDayAdjustments`: `bedtimeFadingMinutes` → przesunięcie pory snu (silnik ogranicza do ±30 min), `maxDaytimeSleepCapMinutes` → korekta limitu snu dziennego (do −60 min).
- `shiftEveryDays` z drzew jest dziś informacją dla tekstu („co 3 dni”); silnik stosuje jeden krok przesunięcia, a kolejne kroki wynikają z nowej oceny drzew na kolejnych danych.
- Tę samą ścieżkę odtwarza pomiar trafności w adminie (`src/lib/admin/calibration.ts`, kolekcja `sleep_predictions`).

---

## 4. Tryby dnia (`DayMode`)

- **`home`**: pełne reguły (WMZ, górna granica pory snu, koniec ostatniej drzemki).
- **`on_the_go`**: dziś liczony tak samo jak `home`; tryb służy do oznaczania dnia w dzienniku. Silnik nie ma jeszcze osobnych reguł dla podróży.
- **`illness_regression`**: okna × 0,8, bez korekt rytmu dobowego. Włącza go rodzic albo zaleca CAT5 (`recommendedDayMode`). Doby chorobowe nie wchodzą do normy snu.

---

## 5. Siedem drzew diagnostycznych (`diagnosticTrees.ts`)

### 5.0. Zasady wspólne
- Orkiestrator `evaluateAll7DiagnosticCategories(input)` zwraca 7 wyników (po jednym na kategorię). Drzewa widzą tylko logi z 14 dni przed `nowIso` (`selectLogsInDiagnosticWindow`).
- Godziny (wczesne pobudki, WMZ, kotwica) liczone w strefie dziecka (`getMinutesFromMidnightInTimeZone`).
- Powtarzalność: wzorce nocne liczone z 7 ostatnich zakończonych nocy (`REPEAT_WINDOW_NIGHTS`); minimum to 3 noce (`REPEAT_MIN_NIGHTS`) albo 5 nocy dla CAT1.
- Brak zapisanego nastroju to brak danych, nie „spokój”.
- Wybór głównej diagnozy (`childEngine.ts`): istotność, potem pewność, potem kolejność kategorii. Nowa diagnoza problemu dostaje status `hypothesis`, powtórzona — `active`; wyniki `info` od razu `active`.
- Teksty dla rodzica: „wzorzec, który często oznacza…”, bez słów „diagnoza” i „kliniczny” oraz bez „kortyzolu”.

### 5.1. Wejście i wyjście
- **Wejście (`DiagnosticEvaluationInput`)**: `nowIso`, `timeZone`, `child` (`birthDateIso`, `dueDateIso`, `activeDayMode`, `currentPlanStartDateIso`), `todayContext` (`tags`, `dayMode`), `recentSleepLogs`, `dailyTotalsLast14DaysMin`, `currentMetrics` (`effectiveAgeDays`, `chronicSleepDebtMin`, `sleepBatteryPercent`, `sleepNeedsProfile`, `biologicalBedtimeMinFromMidnight`). Buduje je `buildDiagnosticInput` w `src/lib/server/childEngine.ts`; przewidywana pora snu jest tam liczona tą samą funkcją co na pulpicie.
- **Wyjście (`DiagnosticTreeResult`)**: `category`, `diagnosisCode`, `severity` (`high` | `medium` | `low` | `info`), `confidenceScore` (0–1), `isTriggered`, `title`, `explanation`, `clinicalAction` oraz opcjonalnie `algorithmOverride`: `wakeWindowOffsetMinutes`, `bedtimeFadingMinutes`, `maxDaytimeSleepCapMinutes`, `recommendedDayMode`, `shiftEveryDays`.

### 5.2. CAT1 — skojarzenia i częste pobudki (`CAT1_ASSOCIATIONS_NIGHT_WAKINGS`)
- Częste pobudki: ≥3 pobudki (`HIGH_NIGHT_WAKINGS_THRESHOLD`) w ≥5 z 7 ostatnich nocy (`ASSOCIATION_MIN_NIGHTS`) [H, spec v2.0; próg 3 pobudek: fiński próg konsultacji, Paavonen 2020 [B, przez prasę]].
- `HIGH_INTERVENTION_SLEEP_ASSOCIATION` (high, 0,85): wiek ≥ 180 dni (`CAT1_MIN_AGE_DAYS`, decyzja 1 Gosi) + częste pobudki + ≥50% nocnych interwencji to karmienie, butelka, bujanie lub noszenie [H].
- `NIGHT_WAKINGS_NORMAL_FOR_AGE` (info, 0,8, `isTriggered: true`): 120–179 dni + częste pobudki → tylko informacja, że to jeszcze norma.
- `HEALTHY_SLEEP_CONSOLIDATION` (info): w pozostałych przypadkach.

### 5.3. CAT2 — opór przed snem i długie zasypianie (`CAT2_BEDTIME_RESISTANCE_LATENCY`)
Średnia latencja (odłożenie → zaśnięcie) ze wszystkich nocy w oknie 14 dni; nastrój = przewaga zapisów `crying` albo `easy`.
- `OVERTIRED_BEDTIME_RESISTANCE` (medium, 0,8): latencja > 20 min + przewaga płaczu + dług > 60 min [H, spec v2.0]. Nadpisanie `wakeWindowOffsetMinutes: -20` (tekst: kładź 20–30 min wcześniej).
- `UNDERTIRED_BEDTIME_FADING` (medium, 0,8): latencja ≥ 30 min + przewaga spokoju. Bedtime fading: `bedtimeFadingMinutes: 15`, `shiftEveryDays: 3`, aż zasypianie trwa ok. 15 min [metoda: Piazza i Fisher 1991, Gradisar 2016 [B]; kroki 15 min co 3 dni: H, spec v2.0].
- `LONG_LATENCY_MOOD_UNKNOWN` (info, 0,5, nieaktywna): latencja ≥ 30 min bez przewagi nastroju → prośba o zapisywanie nastroju.
- `OPTIMAL_BEDTIME_LATENCY` (info).

### 5.4. CAT3 — wczesne pobudki i rozbite noce (`CAT3_EARLY_WAKING_SPLIT_NIGHT`)
- `SPLIT_NIGHT_EXCESS_DAY_SLEEP` (high, 0,85): czuwanie ≥ 60 min w ≥3 z 7 nocy [H]. Nadpisanie `maxDaytimeSleepCapMinutes: -30` (kierunek: Thorpe 2015 [B], głównie po 2. roku).
- Wczesne pobudki: pobudka 04:00–05:30 w ≥3 z 7 nocy. Rodzaj zależy od średniej długości tych nocy (bez czasu wybudzeń) [E: protokół Erin Flynn-Evans, blog Baby Sleep Science 2025; progi H, spec v2.0]:
  - `EARLY_MORNING_WAKING_PHASE_ADVANCE` (medium, 0,75): noc ≥ 10,5 h → rytm przesunięty na wcześniej; `bedtimeFadingMinutes: 15`, `shiftEveryDays: 2`, światło wieczorem, ciemno rano,
  - `EARLY_MORNING_WAKING_SHORT_NIGHT` (medium, 0,75): noc < 9,5 h → „lock-in”: do docelowej pobudki traktować czas jak noc, pierwszą drzemkę liczyć od docelowej pobudki,
  - `EARLY_MORNING_WAKING` (low, 0,6): noc 9,5–10,5 h → zaciemnienie i niezbyt wczesna pierwsza drzemka.
- `NORMAL_CIRCADIAN_WAKE` (info).

### 5.5. CAT4 — krótkie drzemki i przejścia (`CAT4_SHORT_NAPS_TRANSITIONS`)
- `NAP_TRANSITION_READY` (medium, 0,8): opór (latencja ostatniej drzemki ≥ 20 min albo latencja nocy ≥ 30 min) przez ≥5 kolejnych dni [H, spec v2.0], przy typowej liczbie drzemek:
  - 3 drzemki i wiek 120–300 dni → 3→2 (od 4. mies., Mindell 2016 [B]): rezygnacja z trzeciej drzemki,
  - 2 drzemki i wiek 365–548 dni → 2→1 (12–18 mies., Iglowstein 2003 [B]): drzemka +15 min co 3 dni do 12:00–12:30 [H, spec v2.0]; `wakeWindowOffsetMinutes: 15`, `shiftEveryDays: 3`.
- Krótkie drzemki: ≥3 drzemki w oknie, ≥50% z nich ≤ 45 min [H]:
  - wiek < 180 dni → `DEVELOPMENTAL_SHORT_NAPS` (info, `isTriggered: true`): norma wieku,
  - wiek ≥ 180 dni → `SINGLE_CYCLE_SHORT_NAPS` (medium, 0,8): delikatna pomoc ok. 35. minuty drzemki.
- `NAP_STRUCTURE_STABLE` (info).

### 5.6. CAT5 — kryzysy, regresje, choroba (`CAT5_REGRESSION_ILLNESS_CRISIS`)
Kolejność sprawdzania: choroba → wybuch wygaszania → spontaniczny nawrót → ząbkowanie → wzrost pobudek zależny od wieku.
- `ACUTE_ILLNESS_DISRUPTION` (medium, 0,95): tag `gorączka`, `infekcja_ucha` lub `szczepienie` albo tryb choroby. `recommendedDayMode: illness_regression`; powrót do planu 3–5 dni po ustąpieniu objawów [E: Phoenix Children's].
- `EXTINCTION_BURST` (medium, 0,8): noce 2–5 od startu planu (`currentPlanStartDateIso`) z oznakami protestu (pobudki, płacz albo latencja ≥ 20 min) [B: literatura behawioralna, France i in.; wybuch w nocach 2–3]. Bez obietnicy „minie w 48–72 h”.
- `SPONTANEOUS_RELAPSE` (medium, 0,7): po ≥7 nocach planu 2 ostatnie noce mają średnio ≥2 pobudki i ≥1 więcej niż 5 poprzednich [H]. RACGP HANDI nazywa to zjawisko „extinction burst” i opisuje je 2–4 tyg. po wygaszeniu, u ok. 20% dzieci, z powrotem do dobrego snu po kilku nocach [W] — w Spanko to nawrót, nie wybuch (patrz `zrodla.md`, weryfikacja RACGP).
- `TEETHING_DISCOMFORT` (low, 0,7): tag `ząbkowanie`. Nie włącza trybu choroby; wysoka gorączka nie jest objawem ząbkowania [B: Azevedo 2015].
- Wzrost pobudek: 5 ostatnich nocy ma średnio ≥2 pobudki i ≥1 więcej niż wcześniejsze noce z okna (co najmniej 3) [H]:
  - `FOUR_MONTH_SLEEP_REGRESSION` (medium, 0,7): 84–210 dni; opisany jako trwała zmiana architektury snu, bez okna 105–135 dni [B: Lenehan 2023, przegląd 93 badań],
  - `TRANSIENT_DEVELOPMENTAL_REGRESSION` (medium, 0,65): 240–330 lub 540–730 dni; zwykle 2–4 tyg., ponad miesiąc → lekarz [E: Phoenix Children's].
- `STABLE_DEVELOPMENT` (info).

### 5.7. CAT6 — noworodek (`CAT6_NEWBORN_DAY_NIGHT_ACTIVE_SLEEP`)
- `NEWBORN_ACTIVE_SLEEP_GUARDRAIL` (high, 1,0) dla wieku < 112 dni: bez nauki samodzielnego zasypiania, karmienie na żądanie, ok. 60 s odczekania przy kwileniu (sen aktywny) [B, pośrednio: PMC8692310]. „Rytm dobowy dopiero się kształtuje (zwykle 8.–16. tydz.)” zamiast „brak dojrzałej melatoniny”. Przy ≥2 drzemkach > 2 h w ostatnich 7 dobach dochodzi rada, by budzić z drzemki dziennej po 2 h [H, spec v2.0].
- `MATURE_CIRCADIAN_RHYTHM` (info) od 112 dni.
- Kod `DAY_NIGHT_CONFUSION` jest w `DIAGNOSIS_CODES`, ale drzewo go dziś nie zwraca; rada o długich drzemkach przejęła jego rolę.

### 5.8. CAT7 — karmienia nocne (`CAT7_NIGHT_WEANING_FEEDING`)
- Wiek < 180 dni → `NUTRITIONAL_NIGHT_HUNGER` (info): karmienia potrzebne.
- `HABITUAL_NIGHT_FEEDING_ASSOCIATION`: w ≥3 z 7 nocy ≥2 karmienia mlekiem, z czego ≥2 krótkie (≤ 5 min) albo kolejne karmienia co ≤ 60 min [H, spec v2.0; spec mówi o ssaniu < 3 min, ale dziennik zapisuje czas całej pobudki z najkrótszą opcją 5 min].
  - 180–269 dni: severity `low` i dopisek, że zmiana to wybór rodziny [H; brak wytycznej wyznaczającej wiek],
  - od 270 dni: `medium`,
  - przy przewadze karmień piersią: wolniejsze tempo (co 3–4 noce) i ostrzeżenie o laktacji [W: ABM #37, 2023]; przy butelce: mniejsza porcja co 2 noce [H].
- `BALANCED_NIGHT_NUTRITION` (info).

---

## 6. Pozostałe moduły
- `physiologicalDay.ts`: doba fizjologiczna od porannej pobudki do następnej (`resolvePhysiologicalDate`), czas w strefie dziecka.
- `feedingSignals.ts`: sygnały karmienia przed snem i w nocy dla drzew i silnika celów (progi 15/30 min [H]).
- `matrixOverride.ts`: walidacja Zod nadpisanej matrycy z panelu admina (`admin_settings`).
- `insightOverride.ts`: patrz 3.5.

Źródła i poziom dowodu dla każdej liczby: [`zrodla.md`](zrodla.md).
