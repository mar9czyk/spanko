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
- **`on_the_go`**: sen w ruchu (wózek, auto, nosidło) liczy się minuta w minutę, bez „rabatu jakości” (brak dowodów, że jest gorszy). CAT2 i CAT4 nie zgłaszają problemu. Po dniu z niedoborem drzemek > 45 min względem zwykłego snu dziennego (mediana z 7 pełnych dób, `resolveUsualNapStats`) sen nocny wypada wcześniej o połowę niedoboru, maks. 60 min, w krokach po 15 min, bez WMZ i z oknem ≥ porannego minimum (`ON_THE_GO_EARLY_BEDTIME`) [H, częsta praktyka]. Bardzo krótka drzemka < 20 min skraca kolejne okno jak w domu (×0,65).
- **`illness_regression`**: okna × 0,8, bez korekt rytmu dobowego. Włącza go rodzic albo zaleca CAT5 (`recommendedDayMode`). Doby chorobowe nie wchodzą do normy snu. Tag choroby (`ILLNESS_DAY_TAGS`: `gorączka`, `infekcja_ucha`, `szczepienie`, `katar`, `biegunka_wymioty`) działa w drzewach jak tryb (`isIllnessDay`). W chorobie zgłasza się tylko CAT5 (choroba) i CAT6 (noworodek); CAT1–4 i CAT7 są wstrzymane, bo dzień jest nietypowy. Ząbkowanie nie włącza choroby.
- **Podpowiedzi dla rodzica** (`dayModes.ts` → `resolveDayModeGuidance`, treści PL/EN w `src/lib/day-mode-guidance.ts`, karta `DayModeGuidanceCard`): w chorobie tematy wg tagów (gorączka, ucho, katar, wymioty/biegunka, szczepienie) + leki, czego nie robić, powrót do planu i zawsze czerwone flagi (112 / pilnie do lekarza, NICE NG143, NHS, AAP; poniżej 3 mies. ≥38°C od razu SOR lub NiŚOZ). Przy drzemce > 3 h albo > 1,5× zwykłej najdłuższej karta pyta, czy dziecko łatwo się wybudza (`needsWakeCheck`); „nie” pokazuje alarm 112. W drodze: drzemki w ruchu, fotelik (tylko w jeździe, bez „reguły 2 h” jako nauki), wózek, nosidło (TICKS), nowe miejsce. Źródła: raport `badania/reports/Sen w chorobie i w drodze.md`.
- **Podróż ze zmianą strefy** (`travel.ts`, plan w `children.travel_json`, karta `TravelTimeZoneCard`): silnik zwraca momenty ISO, więc strefa wpływa tylko na godziny „od północy” (kotwica, przewidywana pora snu, WMZ, CAT3, granica doby). `resolveScheduleClock` wybiera zegar: `stay_home` liczy w strefie domu (strefa dziecka się nie zmienia), `gradual` liczy w strefie źródłowej i przesuwa rytm o 30 min/dobę na wschód lub 60 min/dobę na zachód (kotwica z nocy sprzed podróży, CAT2–4 wstrzymane do końca przestawiania i dobę dłużej), `local_now` liczy w nowej strefie (CAT2–4 wstrzymane 2 doby). Każdy sen zapisuje `sleep_logs.timezone`, a kotwica i CAT3 liczą godzinę wpisu w jego strefie (`resolveLogTimeZone`; stare wpisy sprzed podróży w strefie źródłowej). Zalecenie (`recommendTravelStrategy`): różnica ≤ 1 h → od razu lokalny; wyjazd ≤ 4 dni i ≤ 3 h → czas domowy; inaczej stopniowo [E: chronobiolożka S. Axelrod, bez badań u niemowląt; liczby H]. Karta pojawia się sama, gdy strefa telefonu różni się od strefy dziecka, a w trybie „W drodze” jest dostępna ręcznie.
