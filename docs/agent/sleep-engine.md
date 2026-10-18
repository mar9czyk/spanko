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

1. **CAT1: Skojarzenia ze snem i pobudki nocne (Sleep Associations & Night Wakings):**
   - Ocena drabiny interwencji: czy dziecko potrafi przejść między cyklami bez poziomu 5 (pierś/butelka/bujanie)?
2. **CAT2: Opór przed snem i długa latencja (Bedtime Resistance & Latency):**
   - Różnicowanie: Overtired (przemęczenie, kortyzol) vs Undertired (niedomęczenie, wejście w WMZ). Zastosowanie techniki *Bedtime Fading*.
3. **CAT3: Wczesne pobudki poranne i Split Nights:**
   - Drzewo Flynn-Evans: pobudka o 04:30 – czy to głód, wyprzedzenie fazy dobowej, czy Split Night (dziecko budzi się w nocy na 1.5h w pełnym humorze z powodu zbyt dużej ilości snu w dzień).
4. **CAT4: Krótkie drzemki i przejścia drzemkowe (Short Naps & Nap Drops):**
   - Diagnoza łączenia cykli (30–45 min), moment przejścia z 3 na 2 lub z 2 na 1 drzemkę.
5. **CAT5: Regresje, kryzysy i skoki rozwojowe:**
   - Detektor regresji 4. miesiąca (dojrzewanie architektury faz NREM/REM).
   - Detektor *Extinction Burst* w 14–28 dniu po wprowadzeniu zmian.
6. **CAT6: Noworodek (<16 tyg.) – Odwrócenie nocy z dniem i sen aktywny (REM):**
   - Reguła pauzy 60 sekund: noworodki w fazie snu aktywnego wydają odgłosy, wiercą się i otwierają oczy bez wybudzenia; rodzic nie powinien interweniować przed upływem 60s.
   - Bezwzględny zakaz metod wypłakiwania (Cry-It-Out) poniżej 16. tygodnia życia.
7. **CAT7: Ograniczanie karmień nocnych (Night Weaning):**
   - Różnicowanie głodu kalorycznego od asocjacji ssania do zaśnięcia na podstawie wieku, masy ciała i rytmu karmień w dzień.
