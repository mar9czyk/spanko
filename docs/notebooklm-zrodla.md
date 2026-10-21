# NotebookLM „Spanko” — źródła i algorytmy snu

Wyciąg z notatnika NotebookLM Gosi (`https://notebooklm.google.com/notebook/dd41cbfc-4699-4854-b29b-3dc5e386e7bb`, 19 źródeł), pobrany 2026-10-20 przez serwer MCP `notebooklm-mcp`.

> **Archiwum.** Kanoniczna lista źródeł z poziomem dowodu i weryfikacją metadanych (m.in. RACGP HANDI) jest w `docs/agent/zrodla.md`. Ten plik zostaje jako zapis tego, co podał notatnik.

> **Uwaga o wiarygodności.** Wszystko poniżej to odpowiedzi Gemini 2.5 (NotebookLM) streszczające źródła, a nie cytaty z nich. Metadane (autor, rok, link) NotebookLM podał tylko tam, gdzie znalazł je w treści źródła; „—” oznacza, że ich nie było. Liczby, od których zależy implementacja, trzeba sprawdzić w oryginale.

## 1. Źródła

| # | Tytuł | Autor / organizacja | Rok | Link |
|---|---|---|---|---|
| 1 | A Nightly Bedtime Routine: Impact on Sleep in Young Children and Maternal Mood (PMC) | — | — | — |
| 2 | Baby Sleep Training Methods Compared (2026) — Baboo | The Baboo Team (FlashSoft) | 2026 | https://babymonitormobile.xyz/blog/sleep-training-methods/ |
| 3 | Baby and Toddler Sleep: What Is Normal at Each Age and the Methods With Evidence (Acibadem) | Dr. Şule Eren, MD | 2026 | https://acibademinternational.com/blog/baby-and-toddler-sleep-what-is-normal-at-each-age-and-the-methods-with-evidence/ |
| 4 | Behavioural intervention: infant sleep problems and maternal mood (HANDI) | RACGP | — | — |
| 5 | Development of infant and toddler sleep patterns: real-world data from a mobile application | — | — | — |
| 6 | Developmental follow-up of children and young people born preterm (NG72) | NICE | 2017 | — |
| 7 | Does Teething Disrupt Infant Sleep? A Longitudinal Auto-Videosomnography Study | — | — | — |
| 8 | Evidence-based Practices in Sleep, Toilet Training, and Screen Use in the First Two Years (JournalAgent) | Elanur Yolal Karimov, Gonca Keskindemirci | 2025 | DOI 10.14744/cm.2025.81300 |
| 9 | How do I fix my child's early waking? — Baby Sleep Science | Erin Flynn-Evans, PhD, MPH | 2025 | https://www.babysleepscience.com/ |
| 10 | How to Recognize an Overtired Baby — Healthline | Rhona Lewis (rec. med. Karen Gill, MD) | 2020 | https://www.healthline.com/health/baby/how-to-recognize-an-overtired-baby |
| 11 | Infant Sleep Training — Rest Easy? (Tools for Practice) | Christina Korownyk, Adrienne J. Lindblad (Alberta College of Family Physicians) | 2017 | — |
| 12 | Managing fever in children under 5 (MAG Online Library) | — | — | — |
| 13 | Managing sleep regression in infants and toddlers | Gary E. Kirkilas, DO (Phoenix Children's Hospital) | 2022 | https://phoenixchildrens.org/articles-faqs/blog/managing-sleep-regression-infants-and-toddlers |
| 14 | Prevalence of Teething Symptoms in Primary Teeth and Associated Factors (12–23 mies.) — Redalyc | M. S. Azevedo, A. R. Portela, A. R. Romano, M. S. Cenci | 2015 | http://www.redalyc.org/articulo.oa?id=63741065023 |
| 15 | Spanko Sleep Engine v2.0 — 3 Sleep Drives & Evolving Insights Spec (Markdown, własna specyfikacja) | — | — | — |
| 16 | The science behind "wake windows" and why they don't matter as much as you think — Baby Sleep Science | Erin Flynn-Evans, PhD, MPH | 2025 | https://www.babysleepscience.com/ |
| 17 | Understanding sleep–wake behavior and sleep disorders in children: the value of a model | Oskar G. Jenni, Monique K. LeBourgeois | 2006 | — |
| 18 | Wake Windows by Age: A Science-Backed Guide to Baby's Sleep Rhythms — Babysense | Dr. Leah M. Alexander (red. Kirsty Macdougall) | 2026 | https://www.babysensemonitors.com/a/nursery-resources/sleep-science/baby-wake-windows-by-age |
| 19 | Your baby's sleep at... 0–3 months | Wirral Community Health and Care NHS Foundation Trust | 2019 | — |

Uwagi: źródła 9 i 16 to dwa artykuły z bloga Baby Sleep Science (link wskazuje tylko stronę główną). Źródło 17 to w oryginale artykuł z *Current Opinion in Psychiatry* (2006), a w notatniku kopia ze strony Integrated Listening Systems.

## 2. Modele regulacji snu

**Model dwuprocesowy** (Borbély 1982; Jenni & LeBourgeois 2006, źr. 17; Flynn-Evans, źr. 16):
- **Proces S (homeostatyczny):** presja snu rośnie wykładniczo w czuwaniu (adenozyna) i spada wykładniczo podczas snu. Markerem jest m.in. latencja zasypiania.
- **Proces C (okołodobowy):** zegar w jądrze nadskrzyżowaniowym (SCN). Wyznacza „bramy snu” i „strefy podtrzymania czuwania” (WMZ). Sygnał czuwania jest najsilniejszy późnym popołudniem i wieczorem.
- Zgranie S i C w pierwszych miesiącach konsoliduje sen nocny, a rozjazd daje pobudki nocne i nadmierny płacz (źr. 17).
- Według Flynn-Evans (źr. 16) „okna czuwania” opisują tylko ostrą presję snu. Pomijają przewlekły dług snu i rytm dobowy, więc same w sobie nie działają.

**Dług snu (źr. 16):** jeśli dziecko potrzebuje ok. 13,5 h na dobę, a przez kilka dni dostaje ok. 12,5 h, narasta przewlekła presja snu. Pojedyncze długie noce i drzemki nie są miarą potrzeb dziecka, tylko odsypianiem. Potrzebę lepiej szacować średnią z wielu dni.

**Przemęczenie (Healthline, źr. 10):** opóźniony sen uruchamia odpowiedź stresową (kortyzol, adrenalina). Wtedy dziecko jest bardziej pobudzone, ziewa, częściej płacze i trudniej je uśpić.

## 3. Wczesne pobudki (Baby Sleep Science, źr. 9)

- Przyczyną może być nawyk (asocjacja senna) albo rytm „zablokowany” na wczesną godzinę, np. przez światło o świcie.
- Na rytm: pełna ciemność do pożądanej godziny pobudki, późniejsze kładzenie, jasne światło wieczorem (pokoje od zachodu), poranny sygnał (zegar świetlny) dla maluchów i brak wczesnej pierwszej drzemki. Długie drzemki są dozwolone, żeby odrobić noc.
- Zbyt wczesne kładzenie może oznaczać, że dziecko po prostu się wyspało, bo ma już pełną noc o 5:00.

## 4. Regresje, ząbkowanie, choroba, wcześniaki

- **Regres 4. miesiąca** (JournalAgent, źr. 8): to trwała zmiana architektury snu z 2 na 4 fazy, z cyklami ok. 50–60 min. Mija, gdy dziecko nauczy się samodzielnie zasypiać.
- **Regresy 8–10 i 18–24 mies.** (Phoenix, źr. 13) wiążą się z kamieniami milowymi motoryki, lękiem separacyjnym i koszmarami. Zwykle trwają 2–4 tygodnie. Jeśli trwają ponad miesiąc, trzeba iść do lekarza.
- **Ząbkowanie** (Redalyc, źr. 14; N=188, 12–23 mies.): 91,9% matek zgłaszało objawy. Najczęstsze były ślinienie 67,7%, drażliwość 65,2%, gorączka 44,1%, problemy z jedzeniem 34,2% i zaburzenia snu 31,7%. Wysokiej gorączki nie należy przypisywać ząbkowaniu.
- **Choroba** (Phoenix, źr. 13; Baboo, źr. 2): przy gorączce, infekcji ucha czy wymiotach trening snu się wstrzymuje, a wraca się do niego 3–5 dni po ustąpieniu objawów. Infekcja ucha mija w 7–10 dni, a sen może wracać do normy do 14 dni.
- **Pilnie do lekarza** (Acibadem, źr. 3): dziecko poniżej 3 mies. z temperaturą od 38°C (rektalnie), a w każdym wieku przy bezdechach, letargu, sztywności karku, uwypuklonym ciemiączku lub powtarzających się wymiotach.
- **Wcześniaki** (NICE NG72, źr. 6): wcześniak to dziecko urodzone przed 37+0 tc. Wiek skorygowany stosuje się do 2. roku życia. Rozszerzony nadzór rozwojowy obejmuje dzieci urodzone przed 30+0 tc. albo między 30+0 a 36+6 tc. z czynnikami ryzyka, a ocenę w wieku 4 lat (nieskorygowanym) dzieci urodzone przed 28+0 tc.
- **Gotowość do treningu snu:** Baboo (źr. 2) i AAP podają nie wcześniej niż 16 tyg. wieku skorygowanego (4–6 mies.). RACGP (źr. 4) mówi o co najmniej 6 mies. JournalAgent (źr. 8) uznaje trening za przeciwwskazany w pierwszych 6 miesiącach i niezalecany w 1. roku życia.

## 5. Progi według wieku

Skróty źródeł: BS = Babysense (18), AC = Acibadem (3), JA = JournalAgent (8), HL = Healthline (10), BSS = Baby Sleep Science (9, 16), NHS = Wirral (19), JL = Jenni & LeBourgeois (17).

| Wiek | Okno czuwania | Sen / 24 h | Drzemki | Inne progi |
|---|---|---|---|---|
| 0–3 mies. | 30–60 min (0–8 tyg., BS); 45–90 min (BS); 60–90 min (2–4 mies., BS); ogólnie 40 min–2 h (BS) | 14–17 h (AASM/WHO, AC); 16–17 h (JA); zakres fizjologiczny 9–20 h | wiele krótkich, bez stałej liczby | cykl snu 45 min (NHS) albo 50–60 min (AC, JA); sen aktywny ok. 50%; karmienia co 2–3 h; rytm dobowy dojrzewa w 8–12 tyg. |
| 4–6 mies. | 1,5–2,5 h (BS) | 12–16 h (AASM/WHO, AC); 14–15 h (JA/HL); 13–14 h w 6. mies. | 2–3 | 38% sześciomiesięcznych nie śpi ciągiem 6 h, a 57% nie śpi 8 h (AC); rutyna 20–30 min (AC, Baboo) albo 30–45 min (JA) |
| 6–12 mies. | 2–3,5 h (6–9 mies.); 3–4 h (9–12 mies.) (BS) | 12–16 h (AASM); 13–15 h; 11–14 h w 12. mies. | 2 (przejście 3→2 w 6–9 mies.) | 28% roczniaków nie śpi ciągiem 6 h (AC); długie zasypianie to ponad 30 min (RACGP) |
| 12–24 mies. | 3–4,5 h (12–18 mies.); 5–6 h (18–24 mies.) (BS) | 11–14 h (AAP/WHO/AASM, AC); 12–13 h (1–3 lata) | 1 (przejście 2→1 w 12–18 mies.) | drzemka ok. 1 h rzadziej przesuwa wieczorne kładzenie (BS) |
| 3–5 lat | cały dzień po rezygnacji z drzemki | 10–13 h (AASM); spadek z ok. 13 h w wieku 2 lat do ok. 11 h w wieku 6 lat (JL) | 0–1, drzemka znika między 3. a 5. rokiem | brak ekranów przed 2. rokiem; ostatnia godzina przed snem bez ekranu (JA, AC) |

**Rozbieżności między źródłami**
- **Okna czuwania:** Babysense podaje sztywne tabele. Flynn-Evans (BSS) i Acibadem uważają je za opinię ekspercką, której nie przetestowano. Acibadem stawia tabele okien, terminy przejść drzemkowych i harmonogramy z aplikacji na najniższym poziomie dowodów.
- **„Przesypianie nocy”:** w badaniach to 6–8 h ciągiem, a rodzice zwykle rozumieją przez to 11–12 h.
- **Długość cyklu snu noworodka** to 45 min według NHS albo 50–60 min według AC i JA.
- **Rutyna przed snem** ma trwać 20–30 min według AC i Baboo albo 30–45 min według JA.
- **Metody z płaczem:** NHS jest przeciw, a AC, Baboo, RACGP, Alberta i JA są za (od 4–6 mies.).

## 6. Metody treningu snu

| Metoda | Min. wiek | Zasady i interwały | Efekt po |
|---|---|---|---|
| Ferber (wygaszanie stopniowane) | 6 mies. (RACGP, JA, Alberta); od 16 tyg. wieku skorygowanego (Baboo, spec. Spanko) | rutyna ok. 20 min, odłożyć dziecko nieuśpione, wizyty do 60 s bez podnoszenia. Dzień 1: 3 / 5 / 10 min; dzień 2: 5 / 10 / 12 min; dzień 4+: 12 / 15 / 17 min (Baboo) | 4–7 nocy (Baboo); 4–6 nocy albo 1–2 tyg. (AC) |
| Cry it out (pełne wygaszanie) | 6 mies. (RACGP, JA); 4–6 mies. (Baboo) | bez wizyt do rana, poza zaplanowanym karmieniem lub kontrolą bezpieczeństwa (Baboo) | 3–5 nocy (Baboo) |
| Krzesło / camping out | 6 mies. (RACGP); 4–6 mies. (Baboo) | krzesło przy łóżeczku i przesuwane co 3 noce: noce 1–3 przy łóżeczku, 4–6 w połowie drogi, 7–9 w drzwiach, 10–12 na korytarzu (Baboo) | 10–14 nocy (Baboo); 1–3 tyg. (RACGP) |
| Pick-up / put-down | 4–5 mies.; odradzane po 6. mies., bo przebodźcowuje (Baboo) | podnieść tylko do uspokojenia i od razu odłożyć, bez kołysania i mówienia | 14–21 nocy (Baboo) |
| Bedtime fading | 6 mies. (Baboo, AC); szczególnie 6–15 mies. i maluchy (BSS) | kładzenie o średniej faktycznej godzinie zasypiania z 5 dni, drzemka krótsza o 15–30 min; gdy zasypia w 15–20 min, kładzenie co 3 dni o 15 min wcześniej | 7–14 nocy (Baboo) |

**Wybuch wygaszania:** pojawia się po 2–4 tygodniach (RACGP; według NotebookLM u ok. 20% dzieci) i trwa 2–3 dni.

**Dowody** (z odpowiedzi NotebookLM przy porównaniu ze specyfikacją; osobne pytanie o dowody notatnik ucinał 5 razy, więc tej części nie pogłębiłam):
- Ponad 50 RCT interwencji behawioralnych u dzieci od ok. 6 mies. W przeglądzie w *Sleep* z 2006 r. 94% badań wykazało poprawę (AC).
- Trening snu pomaga 1 na 4 do 1 na 10 dzieci w porównaniu z brakiem treningu. Po 5 latach nie stwierdzono szkód, a nastrój matek się poprawia (Alberta; RCT Price i in. 2012).
- RACGP: interwencja to 2–3 sesje ze specjalistą, kontrola po 2 tygodniach i dzienniczek snu. Nie dla dzieci poniżej 6 mies. Wybierając między camping out a controlled crying, trzeba uwzględnić rodziców.
- NHS Wirral nie poleca żadnej metody, w której dziecko zostaje z płaczem.
- Źródło 1 (PMC, rutyna przed snem i nastrój matki) nie pojawiło się w żadnej pełnej odpowiedzi. Jego liczby trzeba wyciągnąć osobno.

## 7. Specyfikacja „Spanko Sleep Engine v2.0” w notatniku

W notatniku jest też własny dokument (źr. 15). Jego streszczenie według NotebookLM:

**Trzy napędy snu**
- **Ostra presja snu:** `S_acute(t) = 1 − e^(−t_awake/τ_age)`, gdzie τ_age rośnie z wiekiem. Drzemka ją rozładowuje: `S_post = S_pre · e^(−D_nap/τ_decay)`. Drzemki krótsze niż 30–40 min rozładowują ją tylko częściowo.
- **Przewlekły dług snu (7 dni):** `D_7d = Σ_{k=1..7} w_k · (N_child − T_sleep,k)`, z wagami w₁ = 0,30 i w₂ = 0,22, dalej malejącymi. N_child to przez pierwsze 7 dni mediana dla wieku, a potem 14-dniowa ważona średnia bez dni z chorobą lub regresem, korygowana porannym nastrojem.
  - Filtr odbicia (REBOUND_SLEEP): gdy D_7d > 120 min, a noc jest dłuższa od bazowej o ponad 90 min albo drzemka trwa ponad 150 min, taki dzień nie podnosi N_child.
- **Rytm dobowy C(t):** działa od 10–12 tyg. wieku skorygowanego. Kotwicą jest średnia poranna pobudka z 5 dni. WMZ to okno od −1,5 h do −0,5 h przed biologiczną porą snu i nie kładzie się w nim, chyba że D_7d > 150 min. Od 16 tyg. pora snu to T_bio ±30 min. Ostatnia drzemka musi się skończyć najpóźniej o T_bio − WW_last.

**7 drzew diagnostycznych**
1. Asocjacje i częste pobudki: od 16 tyg., bez gorączki, co najmniej 3 pobudki przez co najmniej 5 nocy w tygodniu. Najpierw noc (7–10 dni). Wybuch wygaszania monitorowany w dniach 14–28.
2. Opór przed snem: przemęczenie, gdy zasypianie > 20 min, płacz i D_7d > 60 min, wtedy kładzenie 20–30 min wcześniej. Niedobór zmęczenia, gdy zasypianie > 30 min przy spokojnym nastroju, wtedy bedtime fading (+15 min co 3 dni).
3. Wczesne pobudki 4:00–5:30: przy nocy co najmniej 10,5 h rytm przesuwa się o 15 min co 2 dni. Przy nocy poniżej 9,5 h zakłada się „lock-in”, czyli ciemność do pożądanej pobudki i pierwszą drzemkę liczoną od niej. Przy podzielonej nocy (ponad 60 min czuwania) drzemki skraca się o 30 min.
4. Krótkie drzemki (poniżej 45 min) i przejścia: przejście wykrywa się po co najmniej 5 dniach z rzędu. Przejście 2→1 (12–18 mies.): drzemka +15 min co 3 dni aż do 12:00–12:30.
5. Kryzysy (regresy 4, 8–10 i 18–24 mies., choroba, zęby): tryb „pause & comfort” i 3–5 dni buforu.
6. Noworodek 0–12 tyg.: trening zablokowany poniżej 16 tyg. Na nocne odgłosy 60-sekundowa pauza przed reakcją. Budzenie z drzemek dłuższych niż 2 h.
7. Nocne karmienia: przed 6 mies. są chronione. Po 6–9 mies. karmienie krótsze niż 3 min co 60 min traktuje się jako asocjację. Skraca się je o 1–2 min co 2 noce.

**Cykl życia wniosków:** HYPOTHESIS (1–2 dni) → ACTIVE_INSIGHT (co najmniej 3 z 5 dni) → VALIDATED → CORRECTED_BY_PARENT / SUPERSEDED (`superseded_by_insight_id`).

**Zgodność z pozostałymi źródłami (ocena NotebookLM)**
- **Poparte:** model S+C, istnienie WMZ, kortyzol przy przemęczeniu, blokada treningu poniżej 16 tyg., wybór metod (Ferber, chair, PUPD, fading), brak szkód po 5 latach (Price i in. 2012), wybuch wygaszania po 2–4 tyg. (RACGP), pauza przy chorobie, protokół wczesnych pobudek, sen aktywny noworodka (ok. 50% cyklu) i wiek skorygowany.
- **Sprzeczne:**
  - NHS Wirral (źr. 19) odradza metody, w których dziecko zostaje z płaczem, w tym controlled crying i pick-up/put-down.
  - Według Baboo (źr. 2) Ferber daje efekt w 4–7 nocy, a pełne wygaszanie w 3–5 nocy, co kłóci się z oknem monitoringu w dniach 14–28.
  - Flynn-Evans ostrzega przed sztywnymi oknami czuwania.
- **Brak w literaturze (autorskie):** konkretne wzory i stałe (τ, wagi 0,30 i 0,22), progi 120, 90, 150 i 150 min, przycinanie ostatniej drzemki wstecz oraz maszyna stanów wniosków.
