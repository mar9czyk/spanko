# Dokumentacja Domenowa: Wytyczne UI/UX (3 AM One-Thumb Dark Mode)

Dokument opisuje filozofię interfejsu aplikacji Spanko zaprojektowanego specjalnie pod realia nocnego usypiania dziecka i obsługi jedną ręką w ciemnym pokoju.

---

## 1. Filozofia „3 AM One-Thumb UX”

### 1.1. Ciemność Chroniąca Melatoninę (Deep Dark Mode)
Ekran telefonu w ciemnej sypialni o 03:00 w nocy nie może oślepiać rodzica ani wybudzać dziecka:
* **Tło aplikacji:** Głęboka, aksamitna czerń/granat `#0B0F17`.
* **Karty i powierzchnie:** `#151B28` (poziom 1), `#1E2738` (poziom 2).
* **Kolory akcentujące:**
  - Ciepły bursztyn (`#F59E0B`): usypianie, karmienia, ciepło, brak wpływu na melatoninę.
  - Kojący fiolet (`#8B5CF6`): sen nocny, faza głęboka, statystyki.
  - Szmaragd (`#10B981`): regeneracja, udany sen, potwierdzenie.
  - Koral (`#EF4444`): płacz, alarm o przemęczeniu.
  - **ZABRONIONE:** Chłodny, jaskrawy błękit w trybie nocnym.

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

Widok `/dashboard` składa się z 5 zintegrowanych stref:

### 3.1. Nagłówek Stanu
- Selektor dziecka (z awatarem i wiekiem w tygodniach/miesiącach).
- Przełącznik **Trybu Dnia**:
  - `[🏠 W domu]`
  - `[🚗 W drodze]`
  - `[🤒 Choroba / Regresja]`
- Przełącznik `Anti-Orthosomnia Mode` (ikona kompasu).

### 3.2. Karta Smart Insight (Wniosek Dnia)
- Prezentuje najważniejszą regułę z `child_insights`.
- Szybkie akcje: `[👍 Działa]` oraz `[✏️ Skoryguj]`.

### 3.3. Centralny Hero Widget (SweetSpot & Bateria Snu)
- **W trakcie czuwania:** Animowany pierścień odliczający czas do kolejnego SweetSpot z informacją o powodzie przesunięcia (np. "Krótka poprzednia drzemka").
- **W trakcie snu:** Zsynchronizowany na żywo stoper trwającego snu (`pb.collection('sleep_logs').subscribe('*')`) — zmiana na telefonie jednego rodzica natychmiast aktualizuje ekran drugiego rodzica.
- **Dla noworodków (<16 tyg.):** W nocy dostępny przycisk `[⏱️ Odczekaj 60s (Active Sleep REM)]` z zegarem odliczającym 60 sekund, przypominający rodzicowi o powstrzymaniu się przed przedwczesnym wyjęciem dziecka z łóżeczka.
- **Stan wyspania (7 dni):** Bez nagłówka „Bateria Snu”. Słowo w kolorze stanu (`Wyspane` zielony / `Lekko niewyspane` bursztynowy / `Mocno niewyspane` różowy, z `resolveSleepRestedness`), 5 segmentów wg baterii 15–100% i jedno zdanie, co silnik z tym robi. Pod spodem etykieta profilu (`Low / Average / High Sleep Needs`) i limit ostatniej drzemki.
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
