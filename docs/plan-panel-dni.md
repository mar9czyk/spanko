# Plan: panel dni na pulpicie (3 ostatnie doby)

Status: zaakceptowany przez Gosię 2026-11-01 (znaczniki pomniejszone na jej prośbę). Makieta: https://claude.ai/artifact/1ei5aagWdpEG3pH44scXx7

## Problem

1. Rozwinięcie doby (lista wpisów pod wykresem) nie daje sygnału: na telefonie karta kończy się przy dolnej krawędzi ekranu, za paskiem akcji, więc po stuknięciu nic się nie zmienia w polu widzenia.
2. Przełączanie dób strzałkami i kalendarzem nie pozwala porównać dziś z wczoraj na jednym ekranie.
3. Wiersz z datą i plakietka „Pobudka 06:30” wyglądają jak przyciski, a nie wiadomo, co robią.
4. Podsumowanie „Drzemki: 2 (2 h 40) · karmienia: 4 · pieluchy: 5” to długi tekst; pieluchy nie rozróżniają siku i kupki.

## Rozwiązanie

### A. Stos trzech dób zamiast nawigacji
- Bez zmian zostaje wszystko nad stosem, w tym karta nasłuchu pobudki (`WakeListenerCard`) pod zegarem.
- Pod pierścieniem sekcja z trzema kartami: **Dziś**, **Wczoraj**, **Przedwczoraj** (najnowsza na górze). Każda karta: etykieta + krótka data (`nd 1.11`), po prawej stan (`trwa` albo `noc 11 h 20`), pasek 24 h, rząd znaczników, stopka „Pokaż N wpisów ˅”.
- Znikają: `TimelineHeader` ze strzałkami, „Dziś”, ikoną kalendarza i plakietką „Pobudka”; stan `viewedDate` i `navigation` w `dashboard/page.tsx`.
- Pod stosem link „Starsze doby w Historii” do `/history` (tam zostaje pełne przeglądanie).
- Dane: bieżąca doba jak dziś (`state.timelineEvents`), dwie poprzednie z `usePastDays(child.id, shiftPhysiologicalDate(today, -1), 2)` (jedno zapytanie). W trybie demo tylko karta Dziś.

### B. Wspólna oś godzin dla porównania
- Wszystkie trzy paski mają tę samą oś zegarową: start = najwcześniejsza poranna pobudka z trzech dób zaokrąglona w dół do pełnej godziny, długość 24 h. Dzięki temu drzemka o 13:00 wczoraj i dziś stoi w tej samej kolumnie.
- Fragment paska przed pobudką danej doby (koniec poprzedniej nocy) rysowany przygaszonym fioletem (ok. 35% krycia), żeby granica doby była widoczna.
- Poranna pobudka = bursztynowa kropka na linii w miejscu pobudki (zastępuje plakietkę z nagłówka).
- Zmiana w `dayStripModel.ts`/`DayHourStrip.tsx`: osobne `axisStartIso` (oś) i `dayStartIso` (granica doby). Dla jednej doby `axisStartIso = dayStartIso`, więc obecne testy zostają ważne.
- Etykiety godzin co 4 h pod każdym paskiem; legenda pod paskiem znika (zastępują ją znaczniki, patrz C).

### C. Ikonki z liczbami zamiast zdania podsumowania
Rząd małych ikonek (15 px, obrys jak lucide, kolor kategorii) z samą liczbą obok (`text-xs`, `text-slate-300`, `tabular-nums`, `gap-x-3.5 gap-y-1`, bez tła, zawijanie). Decyzja Gosi 2026-11-01: żadnych słów, tylko ikonka i liczba.

| Co | Ikonka / kolor | Wartość | Przykład |
|---|---|---|---|
| poranna pobudka | słoneczko (`Sun`), amber-400 | godzina | ☀ `6:40` |
| drzemki | księżyc (`Moon`), amber-500 | **łączny czas drzemek** (nie liczba) | `2 h 40` |
| pobudki nocne (tylko gdy były) | budzik (`AlarmClock`), violet-300 | liczba | `2` |
| karmienia | butelka (`Milk`), emerald-400 | liczba | `4` |
| siku | kropla (`Droplet`), `diaper` #8FC7BE | liczba | `3` |
| kupka | własna ikonka kupki (SVG w stylu lucide, brak w lucide), nowy token `poop` np. #D4A373 | liczba | `1` |

- Zero pokazujemy przygaszone (50% krycia), żeby rzędy trzech dób były porównywalne.
- Ikonki nie są osobnymi przyciskami (cała górna część karty to jeden przycisk rozwijania); `aria-label` przycisku = pełne zdanie podsumowania (np. „Pobudka 6:40, 2 drzemki, razem 2 h 40, 4 karmienia, siku 3, kupka 1”).
- Na pasku zostają małe znaki w tych samych kolorach: karmienie zielona kreska, siku turkusowa kropla, kupka ochrowy romb, pobudka bursztynowa kropka. Pielucha `both` liczy się do obu i rysuje oba znaki. Kolor ikonki = kolor znaku, więc legenda pod paskiem nie jest potrzebna.

### D. Rozwijanie, które widać
- Akordeon: naraz otwarta jedna doba. Stuknięcie w kartę albo stopkę „Pokaż N wpisów ˅” rozwija listę **w tej samej ramce** (zostaje z PR #70), stopka zmienia się w „Zwiń ˄” i trafia na dół listy.
- Po rozwinięciu karta przewija się płynnie tak, by jej górna krawędź była u góry ekranu (`scrollIntoView({ block: "start", behavior })` po zakończeniu animacji; `scroll-margin-top: 12px`). Przy `prefers-reduced-motion` przewinięcie bez animacji.
- Wysokość listy animowana (Framer Motion `AnimatePresence` + `height: auto`, ok. 200 ms), ramka otwartej karty dostaje bursztynową obwódkę `amber-500/45`.
- Stopka „Pokaż N wpisów” to wyraźny, bursztynowy wiersz (min. 44 px) widoczny na dole każdej karty, więc nawet przy karcie przy krawędzi ekranu jest jasne, że coś jest pod spodem.
- Lista: wiersze min. 48 px, godzina po lewej, znak tego samego kształtu co na pasku, tytuł + szczegół. Ostatni wiersz bieżącej doby to „Poranna pobudka” z opisem nocy (`noc 19:20–6:40 · 11 h 20 · 2 pobudki`). Edycja wpisów jak teraz (także dla Wczoraj i Przedwczoraj, przez `pastDays.reload`).
- `main` ma już `pb-32`; sprawdzić, że ostatnia karta da się przewinąć ponad pasek akcji (w razie potrzeby `pb-40` przy aktywnej nocy, jak toasty).

## Schemat bazy

Bez zmian. `day_context.diaper_kind` ma już wartości `wet` / `dirty` / `both`. Szybki przycisk „Pielucha” zapisuje `wet`, a toast pozwala zmienić rodzaj. Nie trzeba importować `pb_schema.json`.

## i18n (PL/EN)
Nowe klucze zamiast `timeline.summary`, `timeline.wake`, `timeline.legend*`, `timeline.previousDay/nextDay/today`: `timeline.dayToday` „Dziś/Today”, `timeline.dayYesterday` „Wczoraj/Yesterday”, `timeline.dayBefore` „Przedwczoraj/2 days ago”, `timeline.chipWake` „pobudka {time}”, `timeline.chipNaps` z odmianą (`1 drzemka`, `2 drzemki`, `5 drzemek`), `timeline.chipNightWakings`, `timeline.chipFeedings`, `timeline.chipWet` „siku {n}/pee {n}”, `timeline.chipDirty` „kupka {n}/poop {n}”, `timeline.showEntries` „Pokaż {n} wpisów” (z odmianą), `timeline.collapse` „Zwiń”, `timeline.olderInHistory`, `timeline.inProgress` „trwa”. Usunąć nieużywane klucze i poprawić `i18n.test.ts`.

## Pliki
- `src/app/(app)/dashboard/page.tsx`: stos trzech `PhysiologicalTimeline`, bez `viewedDate`/`navigation`, stan akordeonu (`openDay`).
- `src/components/dashboard/PhysiologicalTimeline.tsx`: nowy nagłówek karty, znaczniki, stopka, kontrolowane `isExpanded`/`onToggle`, auto-przewinięcie, animacja.
- `src/components/dashboard/DayHourStrip.tsx`, `dayStripModel.ts`: `axisStartIso`, przygaszony fragment przed pobudką, znak pobudki, siku/kupka osobno, bez legendy.
- Nowy czysty helper `daySummary.ts` (liczniki: drzemki, czas drzemek, karmienia, siku, kupka, pobudki nocne) + testy Vitest.
- `tailwind`/`globals.css`: token `poop`.
- `src/i18n/messages.ts`, testy i18n.
- `docs/agent/ux-guidelines.md` sekcja 3.4: opis stosu trzech dób.

## Testy
- Vitest: `daySummary` (both liczy się do siku i kupki, drzemki tylko `type=nap`), `dayStripModel` ze wspólną osią (przygaszone sloty przed pobudką, przesunięcie znaków).
- `pnpm check` i `pnpm test` na zielono; ręcznie na telefonie: rozwinięcie ostatniej karty przewija ją do góry, zwinięcie wraca.
