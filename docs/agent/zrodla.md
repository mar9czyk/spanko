# Źródła silnika snu i silnika celów

Kanon źródeł Spanko i poziom dowodu każdej liczby z `src/lib/sleep-engine/`, `src/lib/goals-engine/`, `src/lib/safe-sleep.ts` i `src/lib/sleep-foundations.ts`. Stan: 2026-10-21, po etapach A–E planu poprawy silnika.

Skąd to jest: raport „Ocena silnika snu Spanko” (2026-10-19, kanon źródeł i tabela werdyktów), wyciąg z notatnika NotebookLM Gosi ([`docs/notebooklm-zrodla.md`](../notebooklm-zrodla.md), 19 źródeł) i weryfikacja metadanych z 2026-10-21 (sekcja 5).

## 1. Poziomy dowodu

| Znak | Poziom | Znaczenie dla kodu i tekstów |
|---|---|---|
| **[B]** | badanie | recenzowana publikacja z danymi (kohorta, RCT, przegląd systematyczny). Można pisać „badania pokazują”. |
| **[W]** | wytyczna | stanowisko instytucji (AAP, AASM, WHO, NICE, RACGP, ABM). Można pisać „zalecenia mówią”. |
| **[E]** | opinia ekspercka | praktyka kliniczna, blog lekarza lub konsultantki, materiał szpitala. Tekst: „często się zaleca”. |
| **[H]** | heurystyka Spanko | stała autorska albo ze specyfikacji Spanko v2.0, bez źródła. W kodzie `// heurystyka`, w tekście bez słów „badania” i „norma”. |

Zasada: liczba [E] lub [H] jest punktem startowym prognozy, który dane dziecka mogą przesunąć. Nie wolno jej przedstawiać rodzicowi jako faktu fizjologicznego ani celu.

## 2. Kanon źródeł

Status: **zweryfikowane** = metadane potwierdzone w źródle pierwotnym lub katalogu; **[NZ]** = szczegóły niezweryfikowane w pełnym tekście (do sprawdzenia przed cytowaniem rodzicom).

### 2.1. Wytyczne czasu snu
| Źródło | Do czego | Status |
|---|---|---|
| Paruthi S i in. Recommended amount of sleep for pediatric populations. *J Clin Sleep Med* 2016;12(6):785–786. [PMC4877308](https://pmc.ncbi.nlm.nih.gov/articles/PMC4877308) | zakresy snu na dobę (AASM) | zweryfikowane |
| WHO. *Guidelines on physical activity, sedentary behaviour and sleep for children under 5 years of age*. 2019 | zakresy 0–4 r.ż. | zweryfikowane (zakresy 1–4 r.ż. [NZ]) |
| Hirshkowitz M i in. National Sleep Foundation's sleep time duration recommendations: methodology and results summary. *Sleep Health* 2015;1(1):40–43. doi:10.1016/j.sleh.2014.12.010 | zakresy uzupełniające | zweryfikowane 2026-10-21 |

### 2.2. Normy empiryczne
| Źródło | Do czego | Status |
|---|---|---|
| Galland BC i in. Normal sleep patterns in infants and children: a systematic review of observational studies. *Sleep Med Rev* 2012;16(3):213–222. [PubMed 21784676](https://pubmed.ncbi.nlm.nih.gov/21784676/) | sumy snu, SD, liczba drzemek, pobudki | zweryfikowane (wartości per wiek [NZ]) |
| Iglowstein I i in. Sleep duration from infancy to adolescence. *Pediatrics* 2003;111(2):302–307 | przejście 2→1, koniec drzemek | zweryfikowane (centyle [NZ]) |
| Paavonen EJ i in. Normal sleep development in infants: findings from two large birth cohorts. *Sleep Med* 2020;69:145 | pobudki, drzemki w 8. mies., próg ≥3 pobudek | metadane zweryfikowane; próg konsultacji tylko z prasy [NZ] |
| Mindell JA i in. Development of infant and toddler sleep patterns: real-world data from a mobile application. *J Sleep Res* 2016;25(5):508. doi:10.1111/jsr.12414 | konsolidacja do 2 drzemek, długość drzemek | zweryfikowane |
| Mindell JA i in. Cross-cultural differences in infant and toddler sleep. *Sleep Med* 2010;11(3):274–280 | różnice kulturowe | zweryfikowane |
| Staton S i in. Many naps, one nap, none: a systematic review and meta-analysis of napping in children. *Sleep Med Rev* 2020;50:101247 | koniec drzemek | zweryfikowane |
| Pennestri M-H i in. Uninterrupted infant sleep, development, and maternal mood. *Pediatrics* 2018;142(6):e20174330. doi:10.1542/peds.2017-4330 | „przesypianie nocy” w 6. i 12. mies. | zweryfikowane 2026-10-21 |
| Brown A, Harries V. Infant sleep and night feeding patterns during later infancy. *Breastfeed Med* 2015;10(5) | pobudki i karmienia nocne | zweryfikowane |
| Breda M, Lucchini M, Barnett N, Bruni O. Early identification of sleep phenotypes in infants by videosomnography: a cross-sectional study. *J Clin Sleep Med* 2025. doi:10.5664/jcsm.11576 | fenotypy (długo, krótko, przerywanie śpiący; n=623, 9–13 mies.) zamiast sztywnej normy | zweryfikowane 2026-10-21 (tom/strony [NZ]) |
| Sadeh A i in. 1995, walidacja aktygrafii u niemowląt | 7 nocy jako okno pomiaru | zweryfikowane (raport) |

### 2.3. Fizjologia: homeostaza, rytm dobowy, drzemki
| Źródło | Do czego | Status |
|---|---|---|
| Jenni OG, Borbély AA, Achermann P. Development of the nocturnal sleep electroencephalogram in human infants. *Am J Physiol Regul Integr Comp Physiol* 2004;286:R528–R538 | dojrzewanie procesu S | zweryfikowane 2026-10-21 (DOI [NZ]) |
| Fattinger S i in. *Sleep* 2014. [PMC3900623](https://pmc.ncbi.nlm.nih.gov/articles/PMC3900623) | fale wolne u niemowląt | zweryfikowane |
| Jenni OG, LeBourgeois MK. Understanding sleep–wake behavior and sleep disorders in children: the value of a model. *Curr Opin Psychiatry* 2006 | model dwuprocesowy u dzieci (z notatnika, źr. 17) | tom/strony [NZ] |
| Lassonde JM, Rusterholz T, Kurth S, Schumacher AM, Achermann P, LeBourgeois MK. Sleep physiology in toddlers: effects of missing a nap on subsequent night sleep. *Neurobiol Sleep Circadian Rhythms* 2016. doi:10.1016/j.nbscr.2016.08.001 | kierunek korekt po drzemce, krótki horyzont długu | zweryfikowane 2026-10-21 (patrz uwaga w sekcji 5) |
| Nakagawa M i in. *Sci Rep* 2016;6:27246. [PMC4899693](https://pmc.ncbi.nlm.nih.gov/articles/PMC4899693/) | późne i długie drzemki a noc | zweryfikowane |
| Thorpe K, Staton S, Sawyer E, Haden C, Smith S. Napping, development and health from 0 to 5 years: a systematic review. *Arch Dis Child* 2015;100(7):615–622 | drzemki po 2. r.ż. a gorsza noc (dowód niski, GRADE) | zweryfikowane 2026-10-21 (pełny DOI [NZ]) |
| LeBourgeois MK i in. *J Biol Rhythms* 2013;28(5):322. [PMC3925345](https://pmc.ncbi.nlm.nih.gov/articles/PMC3925345/) | DLMO a pora snu u maluchów | zweryfikowane |
| Akacem LD, Wright KP, LeBourgeois MK. Bedtime and evening light exposure influence circadian timing in preschool-age children: a field study. *Neurobiol Sleep Circadian Rhythms* 2016 | pora kładzenia wyjaśnia 37% DLMO | zweryfikowane |
| Akacem LD i in. *PLoS One* 2015. [PubMed 25915066](https://pubmed.ncbi.nlm.nih.gov/25915066/) | latencja u drzemiących maluchów | zweryfikowane |
| Joseph D i in. *Arch Dis Child Fetal Neonatal Ed* 2015 ([PubMed 25245173](https://pubmed.ncbi.nlm.nih.gov/25245173/)); Kennaway DJ i in. 1996 ([PubMed 8636362](https://pubmed.ncbi.nlm.nih.gov/8636362/)); Rivkees 2003 | rampa rytmu dobowego 8–16 tyg. | zweryfikowane |
| Giganti F, Fagioli I, Salzarulo P. *Physiol Behav* 2001 | wieczorna strefa czuwania u niemowląt (17–20) | zweryfikowane (abstrakt) |
| Lenehan SM, Fogarty L, O'Connor C, Mathieson S, Boylan GB. The architecture of early childhood sleep over the first two years. *Matern Child Health J* 2023;27(2):226–250. doi:10.1007/s10995-022-03545-9 | „regres 4. miesiąca” jako stopniowe dojrzewanie (93 badania, ok. 90 tys. osób) | zweryfikowane 2026-10-21 |
| Gribbin CE i in. 2012. [PMC3249011](https://pmc.ncbi.nlm.nih.gov/articles/PMC3249011) | brak „skoku kortyzolu” przy przemęczeniu | zweryfikowane |

### 2.4. Wcześniaki
| Źródło | Do czego | Status |
|---|---|---|
| NICE NG72. *Developmental follow-up of children and young people born preterm*. 2017 | definicja < 37+0 tc., korekta do 2. r.ż. | zweryfikowane (z notatnika) |
| AAP HealthyChildren: Preemie milestones; Bennet i in. ([PMC7819838](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7819838/)); Guyer i in. 2015 | wiek skorygowany, sen wcześniaków | zweryfikowane |

### 2.5. Interwencje behawioralne
| Źródło | Do czego | Status |
|---|---|---|
| Mindell JA, Kuhn B, Lewin DS, Meltzer LJ, Sadeh A. Behavioral treatment of bedtime problems and night wakings in infants and young children. *Sleep* 2006;29(10):1263–1276 | 52 badania, 94% skutecznych | zweryfikowane 2026-10-21 |
| Gradisar M i in. Behavioral interventions for infant sleep problems: a randomized controlled trial. *Pediatrics* 2016;137(6):e20151486. doi:10.1542/peds.2015-1486 | wygaszanie stopniowe i bedtime fading (n=43, 6–16 mies.) | metadane zweryfikowane; parametry protokołu (minuty) [NZ] |
| Price AMH, Wake M, Ukoumunne OC, Hiscock H. Five-year follow-up of harms and benefits of behavioral infant sleep intervention: randomized trial. *Pediatrics* 2012;130(4):643–651 | brak szkód po 5 latach | zweryfikowane 2026-10-21 (wielkości efektów [NZ]) |
| Hiscock H, Bayer J, Gold L, Hampton A, Ukoumunne O, Wake M. Improving infant sleep and maternal mental health: a cluster randomised trial. *Arch Dis Child* 2007;92(11):952–958 | nastrój matki jako wynik | zweryfikowane 2026-10-21 |
| Hiscock H, Wake M. Randomised controlled trial of behavioural infant sleep intervention to improve infant sleep and maternal mood. *BMJ* 2002;324(7345):1062–1065 | podstawa RACGP HANDI | zweryfikowane 2026-10-21 |
| Kempler L, Sharpe L, Miller CB, Bartlett DJ. Do psychosocial sleep interventions improve infant sleep or maternal mood in the postnatal period? *Sleep Med Rev* 2016;29:15–22. doi:10.1016/j.smrv.2015.08.002 | 9 badań, n=1656: więcej snu, bez wpływu na pobudki; uzasadnienie bramek wiekowych | zweryfikowane 2026-10-21 |
| Douglas PS, Hill PS. Behavioral sleep interventions in the first six months of life do not improve outcomes for mothers or infants: a systematic review. *J Dev Behav Pediatr* 2013;34(7):497–507 | brak korzyści < 6 mies. | tytuł i czasopismo zweryfikowane; strony [NZ] |
| Piazza CC, Fisher W. *J Appl Behav Anal* 1991;24(1). [PubMed 1957971](https://pubmed.ncbi.nlm.nih.gov/1957971) | bedtime fading | zweryfikowane |
| Meltzer LJ, Mindell JA. Systematic review and meta-analysis of behavioral interventions for pediatric insomnia. *J Pediatr Psychol* 2014;39(8) | bedtime fading, skuteczność | [NZ] |
| Stanzel i in., metaanaliza do 2023; Uzdil i in. 2025 | aktualny stan 2023–2025 | czasopismo i efekty [NZ] |
| Mindell JA, Telofski LS, Wiegand B, Kurtz ES. A nightly bedtime routine: impact on sleep in young children and maternal mood. *Sleep* 2009;32(5):599–606. [PMC2675894](https://pmc.ncbi.nlm.nih.gov/articles/PMC2675894/) | rytuał przed snem (z notatnika, źr. 1) | zweryfikowane 2026-10-21 (strony [NZ]) |
| Mindell JA i in. Bedtime routines for young children: a dose-dependent association with sleep outcomes. *Sleep* 2015;38(5). [PMC4402657](https://pmc.ncbi.nlm.nih.gov/articles/PMC4402657) | rytuał przed snem | zweryfikowane |

### 2.6. Wygaszanie: wybuch i nawrót
| Źródło | Do czego | Status |
|---|---|---|
| France KG i in. [PMC4934563](https://pmc.ncbi.nlm.nih.gov/articles/PMC4934563); Lawton C, France KG, Blampied NM 1991 | wybuch w nocach 2–3, nawrót jako osobne zjawisko | dane noc po nocy [NZ] |
| RACGP HANDI. Behavioural intervention: infant sleep problems and maternal mood. 2014 ([PDF](https://www.racgp.org.au/FSDEDEV/media/documents/Clinical%20Resources/HANDI/Behavioural-intervention-infant-sleep-problems-and-maternal-mood.pdf)) | metody od 6 mies., camping out 1–3 tyg., kontrola po 2 tyg., nawrót 2–4 tyg. po wygaszeniu u ok. 20% | zweryfikowane w oryginale 2026-10-21 (sekcja 5) |

### 2.7. Karmienie piersią, noworodek, ząbkowanie, czerwone flagi
| Źródło | Do czego | Status |
|---|---|---|
| Zimmerman D, Bartick M, Feldman-Winter L, Ball HL i in.; ABM. Clinical Protocol #37: Physiological infant care — managing nighttime breastfeeding in young infants. *Breastfeed Med* 2023;18(3). doi:10.1089/bfm.2023.29236.abm. [PMC10083892](https://pmc.ncbi.nlm.nih.gov/articles/PMC10083892/) | stanowisko ABM przy wyborze metody, ostrożność przy laktacji | metadane zweryfikowane; brzmienie „przeciwwskazane do 6 mies., niezalecane w 1. r.ż.” znane z omówienia (Eglash, IABLE), nie z tekstu protokołu [NZ] |
| Badanie reakcji matek na nocne poruszenia 1-mies. niemowląt. [PMC8692310](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8692310/) | pauza ok. 60 s (pośrednio) | autorzy [NZ] |
| Azevedo MS, Portela AR, Romano AR, Cenci MS. Prevalence of teething symptoms in primary teeth and associated factors (12–23 mies.). 2015 ([Redalyc](http://www.redalyc.org/articulo.oa?id=63741065023)) | ząbkowanie ≠ choroba, sen gorszy u 31,7% (n=188) | czasopismo [NZ] |
| Badanie ząbkowania z autowideosomnografią (z notatnika, źr. 7) | ząbkowanie a sen | autorzy [NZ] |
| AASM / DelRosso; ADC Education & Practice | rozszerzona lista czerwonych flag | zweryfikowane |
| Moon RY, Carlin RF, Hand I; Task Force on SIDS. Sleep-related infant deaths: updated 2022 recommendations for reducing infant deaths in the sleep environment. *Pediatrics* 2022;150(1):e2022057990. doi:10.1542/peds.2022-057990 | stały blok bezpiecznego snu < 12 mies. | zweryfikowane 2026-10-21 (stopnie dowodów [NZ]) |
| Lullaby Trust (temperatura 16–20°C); AAP 2014 (szum z dala od łóżeczka) | „Fundamenty dobrego snu” | [NZ] |

### 2.8. Opinie eksperckie i materiały kliniczne (tylko [E])
| Źródło | Do czego |
|---|---|
| Canapari C. Wake windows ([drcraigcanapari.com](https://drcraigcanapari.com/wake-windows)) | okna czuwania nie są badane w medycynie snu |
| Flynn-Evans E. „How do I fix my child's early waking?” i „The science behind wake windows…”, Baby Sleep Science, 2025 (z notatnika, źr. 9 i 16) | protokół wczesnych pobudek (CAT3), okna czuwania jako opinia |
| Kirkilas GE. Managing sleep regression in infants and toddlers. Phoenix Children's, 2022 (źr. 13) | regresje 8–10 i 18–24 mies., „ponad miesiąc → lekarz”, powrót do planu 3–5 dni po chorobie |
| Eren Ş. Baby and toddler sleep… Acibadem, 2026 (źr. 3) | pilne objawy (gorączka ≥ 38°C < 3 mies., bezdechy, letarg, sztywność karku, ciemiączko, wymioty) |
| Korownyk C, Lindblad AJ. Infant sleep training — rest easy? Tools for Practice, Alberta College of Family Physicians, 2017 (źr. 11) | trening od 6 mies., skuteczność 1 na 4–10 |
| Yolal Karimov E, Keskindemirci G. Evidence-based practices in sleep, toilet training, and screen use in the first two years of life. *Comprehensive Medicine* 2025;17(2):136–142 (źr. 8) | regres 4. mies. jako trwała zmiana; trening niezalecany w 1. r.ż. (przegląd narracyjny, więc [E]) |
| Wirral Community Health and Care NHS FT. Your baby's sleep at 0–3 months. 2019 (źr. 19) | przeciw metodom z płaczem |
| Baboo (źr. 2), Babysense (źr. 18), Healthline (źr. 10) | opis praktyki konsultantów; **nie** jako źródło progów |
| Specyfikacja Spanko Sleep Engine v2.0 (źr. 15) | źródło progów [H] |

### 2.9. AI i regulacje
WHO 2024, *Ethics and governance of AI for health: guidance on large multi-modal models*; FDA General Wellness 2026; MDCG 2019-11 Rev.1 (tekst źródłowy [NZ]); Johns Hopkins 2026, *Academic Pediatrics* (autorzy/DOI [NZ]); Leslie-Miller i in. 2024, *J Pediatr Psychol*. Uzasadniają twarde bariery AI i pozycjonowanie „wellness”.

## 3. Parametry i poziom dowodu

### 3.1. Matryca i wiek skorygowany (`matrix.ts`, `threeDrives.ts`)
| Parametr | Wartość w kodzie | Poziom | Źródło |
|---|---|---|---|
| Mediana snu doby | 960 → 735 min | [W/B] | Paruthi 2016, WHO 2019, Galland 2012 |
| Liczba drzemek noworodka | 3–5 | [B] | Galland 2012 |
| 3→2 drzemki dopuszczone | od 121. dnia | [B] | Mindell 2016 |
| 2 drzemki | 181–390 dni | [B] | Paavonen 2020 |
| 2→1 drzemka | dopuszczona od 391., domyślna od 451. dnia | [B] | Iglowstein 2003 |
| Dzień bez drzemki | dopuszczony od 731. dnia | [B] | Iglowstein 2003, Staton 2020 |
| Wykrycie mniejszej liczby drzemek | ≥5 z 7 dób | [H] | spec v2.0 |
| Okna czuwania | 35–60 … 330–390 min | [E] | Flynn-Evans, Canapari (brak walidacji) |
| Limity drzemek | 120 / 150 min, sen dzienny 450 → 150 min | [H] | miękka sugestia; drzemki rosną do 28. mies. (Mindell 2016) |
| Normy pobudek nocnych | 1,7 → 0,9 (górne 3,4 → 2,5) | [B] | Galland 2012, Paavonen 2020 (interpolacja [H]) |
| τ | 55 → 380 min | [H] | stała autorska |
| Korekta wieku | > 21 dni przed terminem, do 730 dni | [W] | NICE NG72, AAP |

### 3.2. Trzy napędy (`threeDrives.ts`)
| Parametr | Wartość | Poziom | Źródło |
|---|---|---|---|
| Model presja + zegar | rdzeń | [B] | Jenni 2004, Fattinger 2014, Joseph 2015 |
| Korekty po drzemce | < 20 min ×0,65; < 45 min −20; > 95 min +12 | kierunek [B], wartości [H] | Lassonde 2016 |
| Okno pomiaru normy | ≥7 pełnych dób | [B] | Sadeh 1995 |
| Filtr odsypiania | dług > 120 i noc +90 lub drzemka > 150 min | [H] | spec v2.0 |
| Profil potrzeb snu | ±1 SD: 90 min (niemowlę), 60 min (od 1 r.ż.) | [B] | Galland 2012 |
| Horyzont długu | 3 doby, wagi 0,5/0,3/0,2 | horyzont [B], wagi [H] | Lassonde 2016 (kompensacja ok. 24 h) |
| Progi wyspania | 75 / 150 min | [H] | — |
| Skrócenie okna przy długu | −15 min | [H] | — |
| Tryb choroby | okno ×0,8 | [H] | — |
| Choroba: wstrzymanie CAT1–4, CAT7 | dzień nietypowy | [H] | raport „Sen w chorobie i w drodze” |
| Choroba: pytanie o budzenie | drzemka > 3 h lub > 1,5× zwykłej | pytanie [W], próg [H] | NICE NG143, NHS |
| Czerwone flagi | <3 mies. ≥38°C, 3–6 mies. ≥39°C, gorączka >24 h <2 lat, brak mokrej pieluchy 8 h, lista 999 | [W] | NICE NG143, NHS, AAP |
| Powrót do planu po chorobie | ok. 2 doby bez objawów, krok wstecz | [E] | praktyka doradców snu |
| W drodze: sen w ruchu bez rabatu | 100% minut | [H] (brak dowodów na rabat) | Bayer 2011 (dorośli) |
| W drodze: wcześniejszy sen | niedobór > 45 min → połowa, maks. 60 min | [H] | praktyka doradców |
| Podróż: przestawianie strefy | 30 min/dobę na wschód, 60 min/dobę na zachód; czas domowy przy ≤ 4 dniach i ≤ 3 h | [E], liczby [H] | S. Axelrod (chronobiolożka), raport „Sen w chorobie i w drodze” |
| Fotelik: kontrola co 30 min u najmłodszych | <4 mies., wcześniaki | [B] | Arya 2017, Batra 2015, AAP 2022 |
| Przewidywana pora snu | wzór z pobudki, sen nocny 600–690 min | [H] | wzór autorski |
| Domieszka faktycznej pory zaśnięcia | 50%, ≥3 noce, ±120 min | kierunek [B], wartości [H] | Akacem 2016, LeBourgeois 2013 |
| WMZ | 90–30 min przed snem | istnienie [B], okno [H] | Giganti 2001 |
| Wyłączenie WMZ przy długu | ≥150 min | [H] | spec v2.0 |
| Rampa rytmu dobowego | 70 → 112 dni | [B] | Joseph 2015, Kennaway 1996 (start 10 tyg.: spec v2.0) |
| Górna granica pory snu | +30 min od 16 tyg. | [H] | spec v2.0 |
| Koniec ostatniej drzemki | pora snu − `wwMaxEvening` | kierunek [B], odstęp [H] | Nakagawa 2016 |
| Compass Window | ±15 min | [H] | — |
| Limity korekt z drzew | WW ±30, pora snu ±30, sen dzienny do −60 min | [H] | zabezpieczenie |

### 3.3. Drzewa (`diagnosticTrees.ts`)
| Parametr | Wartość | Poziom | Źródło |
|---|---|---|---|
| Okno analizy | 14 dni, powtarzalność z 7 nocy | [H] | spec v2.0 |
| CAT1 próg pobudek | ≥3 na noc w ≥5 z 7 nocy | próg [B, prasa], powtórzenia [H] | Paavonen 2020, spec v2.0 |
| CAT1 wiek | diagnoza od 180 dni, 120–179 dni informacja | [B/W] + decyzja Gosi | Kempler 2016, RACGP; decyzja 1 |
| CAT1 przewaga silnych interwencji | ≥50% | [H] | — |
| CAT2 przemęczenie | latencja > 20 min + płacz + dług > 60 min; −20 min | [H] | spec v2.0 |
| CAT2 niedomęczenie | latencja ≥ 30 min + spokój | [E/W] | RACGP: długie zasypianie > 30 min |
| Bedtime fading | +15 min co 3 dni, cel ok. 15 min latencji | metoda [B], liczby [H] | Piazza 1991, Gradisar 2016; spec v2.0 |
| CAT3 rozbita noc | czuwanie ≥ 60 min w ≥3 nocach; sen dzienny −30 min | [H] | związek z drzemkami: Thorpe 2015 |
| CAT3 wczesna pobudka | 04:00–05:30 w ≥3 nocach | [H] | — |
| CAT3 długość nocy | ≥10,5 h rytm, < 9,5 h lock-in; 15 min co 2 dni | protokół [E], progi [H] | Flynn-Evans 2025, spec v2.0 |
| CAT4 krótka drzemka | ≤ 45 min, ≥50% drzemek | [H] | — |
| CAT4 norma krótkich drzemek | < 180 dni | [E] | — |
| CAT4 przejście | opór ≥5 dni z rzędu; 3→2 120–300 dni; 2→1 365–548 dni; +15 min co 3 dni | wiek [B], reszta [H] | Mindell 2016, Iglowstein 2003; spec v2.0 |
| CAT5 wybuch wygaszania | noce 2–5 od startu planu | [B] | France i in., Lawton 1991 |
| CAT5 spontaniczny nawrót | po ≥7 nocach planu, +1 pobudka | zjawisko [W], progi [H] | RACGP HANDI |
| CAT5 zmiana snu ok. 4. mies. | 84–210 dni, trwała zmiana | [B] | Lenehan 2023 |
| CAT5 regresje 8–10, 18–24 mies. | 2–4 tyg., > 1 mies. → lekarz | [E] | Phoenix Children's |
| CAT5 ząbkowanie | nie włącza trybu choroby | [B] | Azevedo 2015 |
| CAT5 powrót po chorobie | 3–5 dni | [E] | Phoenix Children's, Baboo |
| CAT6 ochrona noworodka | < 112 dni | [W/B] | AASM, Mindell 2006; rytm 8–16 tyg.: Joseph 2015 |
| CAT6 pauza przy kwileniu | ok. 60 s | [B, pośrednio] | PMC8692310 |
| CAT6 budzenie z drzemki | > 2 h, ≥2 razy w 7 dobach | [H] | spec v2.0 |
| CAT7 wiek | od 180 dni; do 270 dni wybór rodziny | [H] | brak wytycznej; ABM #37 ostrzega |
| CAT7 karmienie dla uspokojenia | ≥2 karmienia, ≤ 5 min lub co ≤ 60 min, w ≥3 nocach | [H] | spec v2.0 (< 3 min) |
| CAT7 tempo przy piersi | co 3–4 noce, ostrzeżenie o laktacji | [W] tempo [H] | ABM #37 |

### 3.4. Silnik celów i bezpieczeństwo (`goals-engine/*`, `safe-sleep.ts`, `sleep-foundations.ts`)
| Parametr | Wartość | Poziom | Źródło |
|---|---|---|---|
| Brak treningu < 16 tyg. | blokada | [W] | AASM, Mindell 2006 |
| Łagodne metody | od 120 dni | [W/E] | AAP i Baboo wg notatnika; spór z ABM i RACGP (6 mies.) |
| Metody stanowcze (Ferber, wygaszanie) | od 180 dni | [B/W] | Kempler 2016, Gradisar 2016 (6–16 mies.), RACGP |
| Stanowisko ABM przy wyborze metody | jedno zdanie | [W] | ABM #37 (decyzja 2 Gosi) |
| Ferber | noc 1: 3/5/10, noc 2: 5/10/12, noc 3: 10/12/15, noce 4–7: 12/15/17 min; wizyta do 60 s | [E] | Baboo (noc 3 interpolowana [H]) |
| Ferber efekt | 4–7 nocy | [E] | Baboo, Acibadem |
| Krzesło | 4 pozycje × 3 noce = 12 nocy | [E] | Baboo; RACGP: camping out 1–3 tyg. [W] |
| Weź–odłóż | 14 nocy + utrwalenie; ostrzeżenie po 180 dniach | [E] | Baboo (decyzja 4 Gosi) |
| Łagodne wygaszanie | 2 noce na szczebel, 7–14 nocy | [H] | — |
| Odstawianie mleka | 75/50/25% porcji, 2 noce na krok | [H] | — |
| Nawyki snu | 3 noce na nawyk + 2 noce utrwalenia | [H] | — |
| Minimum danych | 3 doby (ostrzeżenie < 5) | [H] | — |
| Sukces celu | cel w ≥5 z 7 nocy + potwierdzenie rodzica | [H] | ok. 79% budzi się ≥1× (Brown i Harries 2015) |
| Cofnięcie kroku | średnia z 2 dób > 130% linii bazowej | [H] | — |
| Czerwone flagi | lista z `goal-copy.ts` | [W/E] | AASM, ADC E&P, Acibadem |
| Bezpieczny sen | stały blok < 12 mies. | [W] | Moon 2022 (AAP) |
| Filtr fraz zakazanych w AI | łóżko dorosłych, brzuch/bok, pozycja pochyła, poduszki, trening < 16 tyg. | [W] | Moon 2022, AASM |
| Fundamenty: rytuał przed snem | stała rutyna | [B] | Mindell 2009, Mindell 2015 |
| Fundamenty: temperatura | 16–20°C | [E] | Lullaby Trust [NZ] |
| Fundamenty: stała pora pobudki | kotwica rytmu | [H] | — |
| Miejsce snu: łóżko rodziców, palenie, wózek | stałe flagi bezpieczeństwa (`sleep-environment.ts`) | [W] | Moon 2022 (AAP), raport „Czynniki środowiskowe snu” |
| Miejsce snu: kosz Mojżesza, łóżko Montessori | porada bez liczb (limit producenta) | [E] | producenci, zdrowy rozsądek |
| Szum: cicho i > 2 m od łóżeczka | porada przy „nie wiem” | [W] | AAP 2014 |
| Rolety / ekran przed snem | kontekst dla CAT3/CAT2/CAT4, bez zmiany liczb | [B/E] | raport „Czynniki środowiskowe snu” |

## 4. Czego nie używać jako źródła
- „Drzewo Flynn-Evans” jako publikacji: to wpis blogowy ekspertki (opinia [E]), nie badanie.
- „Przemęczenie → skok kortyzolu”: jedyne źródło to Healthline 2020; badanie Gribbin 2012 pokazało spadek kortyzolu. W tekstach: „przemęczone dziecko często trudniej zasypia”.
- Middlemiss 2012 jako dowód szkody treningu: 25 dzieci, bez grupy kontrolnej.
- Dane firmowe Owlet, Nanit, Huckleberry jako normy: to materiały prasowe (wyjątek: recenzowana praca Breda 2025 na danych Nanit).
- Tabele okien czuwania z Babysense i Baboo jako źródło progów: tylko opis praktyki.
- Okno „wybuchu wygaszania” 14–28 dni i „ustąpi w 48–72 h”: usunięte w etapie C.

## 5. Weryfikacja z 2026-10-21

Sprawdzono w katalogach (PubMed, strony wydawców i repozytoriów uczelni) i w oryginale RACGP. PubMed Central i NCBI E-utilities były niedostępne z tego środowiska, więc pozycje wymagające pełnego tekstu PMC pozostają [NZ].

**RACGP HANDI (termin wybuchu wygaszania) — rozstrzygnięte.** Oryginał (HANDI, maj 2014) mówi: „Warn parents about ‘extinction bursts’. This is a burst of behaviour that happens 2–4 weeks after the behaviour was extinguished. This occurs in about 20% of infants and takes the form of infants waking again overnight in the absence of an explanation… infants typically settle back to their good sleep habits after a few nights.” Wniosek: RACGP nazywa „extinction burst” zjawisko, które literatura behawioralna nazywa spontanicznym nawrotem (powrót po tygodniach poprawy). Wybuch w ścisłym sensie (noce 2–3 po odstawieniu wzmocnienia) to coś innego. Kod po etapie C jest zgodny z obiema lekturami: `EXTINCTION_BURST` w nocach 2–5 i `SPONTANEOUS_RELAPSE` po ≥7 nocach z tekstem „zwykle szybko mija”. Ten sam dokument potwierdza: interwencja nie dla dzieci < 6 mies., camping out 1–3 tyg., 2–3 sesje, kontrola po 2 tyg., dzienniczek snu. Literatura RACGP: Hiscock i Wake 2002, Hiscock i in. 2007, Price i in. 2012.

**Uzupełnione metadane (wcześniej [NZ]):** Hirshkowitz 2015 (DOI), Kempler 2016 (autorzy, strony, DOI, wyniki), Mindell 2006 (tom, strony), Hiscock 2007 (strony), Price 2012 (strony), Pennestri 2018 (DOI), Lassonde 2016 (autorzy, DOI), Jenni 2004 (strony), Thorpe 2015 (autorzy, strony), przegląd PubMed 36586054 (Lenehan i in. 2023, czasopismo, DOI), Breda i Bruni 2025 (czasopismo *J Clin Sleep Med*, DOI), ABM #37 (czasopismo, DOI), Moon 2022 (numer artykułu, DOI), Gradisar 2016 (DOI, próba), Yolal Karimov 2025 (czasopismo, strony), Mindell 2009 (źr. 1 notatnika).

**Korekta opisu Lassonde 2016.** Raport podał, że „łączna energia fal wolnych drzemki i nocy pozostaje ta sama, czyli organizm wyrównuje bilans tej samej nocy”. Streszczenie mówi dokładniej: suma energii fal wolnych z drzemki i nocy nie różniła się istotnie od nocy po pominiętej drzemce (p = 0,12), a po pominiętej drzemce rosła aktywność fal wolnych, skracało się zasypianie i wydłużał sen. Kierunek reguł Spanko (krótka drzemka → krótsze okno, krótki horyzont długu) zostaje, ale „kompensacja w ok. 24 h” to interpretacja, nie wynik wprost.

**Nadal [NZ]:** wartości per wiek z Galland 2012; centyle Iglowstein 2003; próg „≥3 pobudki = konsultacja” z Paavonen 2020 (repozytorium zablokowane, znany z prasy); minuty protokołów Gradisar 2016; dane noc po nocy France i in. (PMC4934563) i Lawton 1991; brzmienie zakazu treningu w samym protokole ABM #37; autorzy PMC8692310 i badania ząbkowania z autowideosomnografią; Meltzer i Mindell 2014; Stanzel, Uzdil; MDCG 2019-11; Johns Hopkins 2026; Lullaby Trust; DOI Jenni 2004 i Thorpe 2015.

## 6. Luki
- Polskie i europejskie wytyczne bezpiecznego snu (polskie towarzystwa pediatryczne, NHS, Lullaby Trust) nie zostały przeszukane.
- Żaden parametr prognozy nie ma walidacji u dzieci. Trafność mierzy panel „Trafność prognoz” w adminie (kolekcja `sleep_predictions`); kalibracja liczb [H] powinna iść z tych danych.
- Treści metod wymagają przeglądu przez konsultanta snu przed publicznym startem.
