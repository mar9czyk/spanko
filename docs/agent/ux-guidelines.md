# Dokumentacja Domenowa: Wytyczne UI/UX (3 AM One-Thumb Dark Mode)

Dokument opisuje filozofię interfejsu aplikacji Spanko zaprojektowanego specjalnie pod realia nocnego usypiania dziecka i obsługi jedną ręką w ciemnym pokoju.

---

## 1. Filozofia „3 AM One-Thumb UX”

### 1.1. Ciemność Chroniąca Melatoninę (Deep Dark Mode)
Ekran telefonu w ciemnej sypialni o 03:00 w nocy nie może oślepiać rodzica ani wybudzać dziecka:
* **Tło aplikacji:** Głęboka, aksamitna czerń/granat `#0B0F17`.
* **Karty i powierzchnie:** `#151B28` (poziom 1), `#1E2738` (poziom 2).
* **Tekst:** główny w ciepłej złamanej bieli `#DDD8CF` (klasa `text-ink`, ok. 13,5:1; czysta biel nocą powoduje halację). Drugi plan minimum `slate-400`; `slate-500` tylko dla placeholderów i elementów wyłączonych, `slate-600` tylko dla dekoracji (linie, separatory).
* **Kolory akcentujące:**
  - Ciepły bursztyn (`#F59E0B`): usypianie, karmienia, ciepło, brak wpływu na melatoninę.
  - Kojący fiolet (`#8B5CF6`): sen nocny, faza głęboka, statystyki.
  - Szmaragd (`#10B981`): regeneracja, udany sen, potwierdzenie.
  - Łagodny koral (`coral-400` `#F28B82`): płacz, mocne niewyspanie, alarm o przemęczeniu. Czerwień (`red-*`) wyłącznie dla błędów technicznych i akcji niszczących.
  - Przygaszony turkus (`diaper` `#8FC7BE`): pieluchy.
  - **ZABRONIONE:** Chłodny, jaskrawy błękit w trybie nocnym (np. `sky-400`).
* **Typografia:** font Atkinson Hyperlegible Next (`latin` + `latin-ext` dla polskich znaków). Minimum `text-xs` (12 px), bez `text-[Npx]`; treści czytane nocą (timery, pigułki, oś czasu, karta wniosku) `text-sm`–`text-base`. Zmieniające się liczby (timery, godziny) z `tabular-nums`; `font-mono` tylko w panelu admina (kody, JSON).
* **Ruch:** animacje respektują `prefers-reduced-motion` (`MotionConfig reducedMotion="user"` + reguła w `globals.css`).

### 1.2. Zero Pisania w Nocy (Zero Mandatory Typing)
* Żadna nocna operacja nie może wymagać klawiatury ekranowej.
* Wszystkie akcje odbywają się za pomocą 1 dotknięcia (1-tap):
  - Przyciski dotykowe min. $48 \times 48\text{ px}$.
  - Predefiniowane pigułki czasu (`[5 min]`, `[15 min]`, `[1h+]`).
  - Wybór interwencji za pomocą czytelnych ikon i selektorów.

### 1.3. Ergonomia Jednego Kciuka (Thumb Reach Zone)
* Wszystkie krytyczne akcje (start usypiania, oznaczenie pobudki, karmienie) są zakotwiczone w dolnych 40% ekranu w pływającym pasku akcji (**Floating Action Bar**).
* Formularze szczegółowe wysuwają się z dołu jako **Bottom Sheet** (Framer Motion) i można je zamknąć gestem przesunięcia w dół.

---

## 2. Tryb Anti-Orthosomnia Mode (Dla Spokoju Rodzica)

Ortosomnia to zaburzenie lękowe wywołane obsesyjnym śledzeniem wskaźników snu przez aplikacje i zegarki:
* **Problem:** Rodzic widzący komunikat "Połóż dziecko o 13:14" wpada w panikę, gdy o 13:16 dziecko nadal nie śpi.
* **Rozwiązanie (Anti-Orthosomnia Mode):**
  - Przełącza widok z precyzyjnego zegara na **Miękki Kompas Snu**:
    - Zamiast: *"Kolejna drzemka: 13:14"*
    - Pokazuje: *"Wypatruj oznak zmęczenia (ziewanie, tarcie oczu) między 13:00 a 13:30"*.
  - Przedział jest wyliczany jako $[\text{SweetSpot} - 15\text{ min}, \text{SweetSpot} + 15\text{ min}]$.

---

## 3. Struktura Ekranu Głównego („Tu i Teraz”)

Widok `/dashboard` składa się z zintegrowanych stref:

### 3.1. Nagłówek Stanu
- Selektor dziecka (z awatarem i wiekiem w tygodniach/miesiącach).
- Przełącznik **Trybu Dnia**:
  - `[🏠 W domu]`
  - `[🚗 W drodze]`
  - `[🤒 Choroba / Regresja]`
- Przełącznik `Anti-Orthosomnia Mode` (ikona kompasu).

### 3.2. Bąbelki skrótów dnia i wspólny arkusz
- Wokół pierścienia stoją 4 okrągłe bąbelki (64 px): **wyspanie** (np. `3/5`, kolor stanu), **cel** (`odhaczone/wszystkie` zadania dnia), **wniosek** (żarówka z bursztynową kropką, dopóki rodzic nie dał opinii) i **ostatnia drzemka** (`HH:mm`). Bąbelek bez danych (brak celu lub wniosku) się nie pojawia.
- Każdy bąbelek otwiera **jeden wspólny arkusz** od dołu (połowa ekranu) na własnej zakładce. Przesunięcie w bok zmienia zakładkę, w dół lub stuknięcie obok zamyka, w górę rozciąga do pełnej wysokości. Nigdy arkusz na arkuszu.
- Zakładki: *Wyspanie* (słowo stanu, 5 segmentów, zdanie o skutku, profil potrzeb), *Cel* (tytuł, metoda · dzień, postęp, zadania z krótkimi tytułami odhaczane w miejscu, (i) z pełnym opisem, zwinięte „Rady na dziś i dlaczego tak”, wstrzymaj i zakończ na dole), *Wniosek* (kategoria, tytuł, wyjaśnienie, Działa / Skoryguj, link do historii), *Ostatnia drzemka* (duża godzina + jedno zdanie po co).
- Stuknięcie w pierścień pokazuje na ok. 4 s dymek z powodem tej pory (zastępuje etykietę pod pierścieniem).
- W trakcie snu (w tym w nocy) bąbelków nie ma, a karty celu i wniosku nie wiszą na ekranie.

### 3.3. Centralny Hero Widget (SweetSpot & Bateria Snu)
- **W trakcie czuwania:** Animowany pierścień odliczający czas do kolejnego SweetSpot z informacją o powodzie przesunięcia (np. "Krótka poprzednia drzemka").
- **W trakcie snu:** Zsynchronizowany na żywo stoper trwającego snu (`pb.collection('sleep_logs').subscribe('*')`) — zmiana na telefonie jednego rodzica natychmiast aktualizuje ekran drugiego rodzica.
- **Dla noworodków (<16 tyg.):** W nocy dostępny przycisk `[⏱️ Odczekaj 60s (Active Sleep REM)]` z zegarem odliczającym 60 sekund, przypominający rodzicowi o powstrzymaniu się przed przedwczesnym wyjęciem dziecka z łóżeczka.
- **Stan wyspania (7 dni):** Teraz w bąbelku i zakładce „Wyspanie” (3.2), bez nagłówka „Bateria Snu”. Słowo w kolorze stanu (`Wyspane` zielony / `Lekko niewyspane` bursztynowy / `Mocno niewyspane` różowy, z `resolveSleepRestedness`), 5 segmentów wg baterii 15–100% i jedno zdanie, co silnik z tym robi. Pod spodem etykieta profilu (`Low / Average / High Sleep Needs`) i limit ostatniej drzemki.
- **Backwards Nap Capping:** Wyraźny wskaźnik "Koniec ostatniej drzemki maks. o HH:mm", aby nie zakłócić snu nocnego.

### 3.4. Oś Czasu Doby Fizjologicznej
- Karty zdarzeń bieżącej doby (drzemki, karmienia piersią L/P lub butelką ml, tagi ząbkowania/spaceru).
- Wyraźne oznaczenie granicy doby (poranna pobudka).

### 3.5. Dolny Pasek Akcji (Floating Action Bar)
- **Główny Przycisk Cyklu:**
  1. `[▶ Start usypiania]` (status: `falling_asleep`)
  2. `[💤 Zasnął]` (status: `sleeping`)
  3. `[■ Obudził się]` (status: `completed`)
- **Nocny Przycisk Błyskawiczny:** W trakcie snu nocnego wyświetla się duży przycisk `[⚡ Szybka pobudka / Mleko]`, który jednym dotknięciem rejestruje zdarzenie bez wybudzania rodzica formularzami.
- **Poranne Podsumowanie Pobudek (Morning Summary Banner):**
  - Po kliknięciu rano `[■ Obudził się na dzień]`, jeśli w nocy odnotowano szybkie pobudki, pojawia się baner z pigułkami:
    *"W nocy o 01:20 i 03:45 odnotowano pobudki. Ile mniej więcej trwały? `[5 min]` `[15 min]` `[1h+]`"*.
- **Przycisk Dodawania:** Otwiera Bottom Sheet do rejestracji karmienia, leków czy nastroju zasypiania.
