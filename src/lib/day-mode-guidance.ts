/**
 * Treści podpowiedzi trybów dnia „Choroba” i „W drodze” (PL/EN).
 *
 * @description
 * Tekst deterministyczny — nigdy nie pochodzi z AI. Wybór tematów robi silnik
 * (`resolveDayModeGuidance` w `src/lib/sleep-engine/dayModes.ts`).
 * Źródła: NICE NG143 (gorączka), NICE NG91 (ucho), NHS, AAP 2011 i 2022, Lullaby Trust,
 * Batra 2015, Arya 2017, TICKS; szczegóły i poziom dowodów w raporcie „Sen w chorobie i w drodze”.
 * Rady oznaczone jako praktyka nie mają oparcia w badaniach i tak je opisujemy rodzicom.
 */

import type { GuidanceTopic } from "@/lib/sleep-engine/dayModes";

export type GuidanceLocale = "pl" | "en";

export interface GuidanceSection {
  readonly title: string;
  readonly items: readonly string[];
}

type Localized<T> = Readonly<Record<GuidanceLocale, T>>;

export const GUIDANCE_TOPICS: Readonly<Record<GuidanceTopic, Localized<GuidanceSection>>> = {
  illness_general: {
    pl: {
      title: "Sen w chorobie",
      items: [
        "Chore dziecko zwykle śpi więcej i częściej się budzi. Dłuższe i wcześniejsze drzemki są w porządku, nie budź go dla planu.",
        "Noszenie, karmienie czy kołysanie do snu w chorobie nie psuje nawyków. Po wyzdrowieniu zwykle wystarczy kilka nocy, by wrócić do rytmu.",
        "Często podawaj pierś, mleko lub picie, także w nocy. Nocne karmienia w chorobie to nie problem do wygaszania.",
        "Zaglądaj do dziecka w nocy.",
        "Do snu jak zawsze: na plecach, na płaskim materacu, we własnym łóżeczku.",
      ],
    },
    en: {
      title: "Sleep during illness",
      items: [
        "A sick child usually sleeps more and wakes more often. Longer and earlier naps are fine, don't wake them to keep to the plan.",
        "Holding, feeding or rocking to sleep while ill doesn't ruin habits. After recovery a few nights are usually enough to get back on track.",
        "Offer the breast, milk or drinks often, including at night. Night feeds during illness are not something to wean.",
        "Check on your child during the night.",
        "Sleep as always: on the back, on a flat mattress, in their own cot.",
      ],
    },
  },
  fever: {
    pl: {
      title: "Gorączka",
      items: [
        "Ubierz lekko i nie przykrywaj grubo, ale nie rozbieraj do naga ani nie obmywaj letnią wodą. W pokoju ok. 16–20°C.",
        "Lek przeciwgorączkowy podaje się na złe samopoczucie, nie na sam wynik termometru. Nie zapobiega drgawkom gorączkowym.",
        "Nie budź śpiącego dziecka tylko po to, żeby podać lek.",
      ],
    },
    en: {
      title: "Fever",
      items: [
        "Dress lightly and don't bundle up, but don't strip them or sponge with tepid water. Keep the room at about 16–20°C.",
        "Fever medicine is for discomfort, not for the number on the thermometer. It doesn't prevent febrile seizures.",
        "Don't wake a sleeping child just to give medicine.",
      ],
    },
  },
  ear: {
    pl: {
      title: "Ból ucha",
      items: [
        "Ból ucha zwykle mija po ok. 3 dniach, czasem trwa do tygodnia.",
        "Lek przeciwbólowy (paracetamol lub ibuprofen) można podawać regularnie, także przed snem, według ulotki lub lekarza.",
        "Ukój na rękach, a do snu odłóż płasko na plecach.",
        "Krople i leki obkurczające ani przeciwhistaminowe nie pomagają na ucho.",
      ],
    },
    en: {
      title: "Ear pain",
      items: [
        "Ear pain usually eases after about 3 days, sometimes up to a week.",
        "Pain relief (paracetamol or ibuprofen) can be given regularly, including before sleep, as the leaflet or doctor says.",
        "Comfort them in your arms, then lay them down flat on their back to sleep.",
        "Decongestants and antihistamines don't help ear infections.",
      ],
    },
  },
  cold: {
    pl: {
      title: "Katar",
      items: [
        "Przed snem i karmieniem: sól fizjologiczna do nosa i delikatne odessanie aspiratorem. Dowody są słabe, ale to bezpieczne.",
        "Nawilżacz tylko z chłodną mgiełką; codziennie opróżniaj i susz zbiornik. Parowy grozi oparzeniem.",
        "Nie podnoś materaca i nie podkładaj klina: to nie pomaga, a dziecko może się zsunąć w niebezpieczną pozycję.",
        "Bez maści z kamforą lub mentolem (np. Vicks) poniżej 2 lat, bez syropów na kaszel i przeziębienie poniżej 4 lat, bez miodu poniżej 1 roku.",
      ],
    },
    en: {
      title: "Blocked nose",
      items: [
        "Before sleep and feeds: saline drops and gentle suction with a nasal aspirator. Evidence is weak, but it's safe.",
        "Use only a cool-mist humidifier; empty and dry the tank every day. Steam can burn.",
        "Don't raise the mattress or use a wedge: it doesn't help and your baby can slide into an unsafe position.",
        "No camphor or menthol rubs (e.g. Vicks) under 2, no cough and cold medicines under 4, no honey under 1 year.",
      ],
    },
  },
  gastro: {
    pl: {
      title: "Wymioty i biegunka",
      items: [
        "Wymioty zwykle trwają 1–2 dni, biegunka 5–7 dni.",
        "Małe porcje picia, ale często. Kontynuuj pierś lub mleko; pomaga doustny płyn nawadniający z apteki.",
        "Bez leków przeciwbiegunkowych. Przy odwodnieniu o ibuprofen zapytaj lekarza lub farmaceutę.",
        "Sprawdzaj pieluchy: brak mokrej pieluchy przez 8 godzin to powód, by pilnie skontaktować się z lekarzem.",
      ],
    },
    en: {
      title: "Vomiting and diarrhoea",
      items: [
        "Vomiting usually lasts 1–2 days, diarrhoea 5–7 days.",
        "Small sips, often. Keep up breast or milk feeds; an oral rehydration solution from the pharmacy helps.",
        "No anti-diarrhoea medicines. If your child is dehydrated, ask a doctor or pharmacist before ibuprofen.",
        "Watch the nappies: no wet nappy for 8 hours means contact a doctor urgently.",
      ],
    },
  },
  vaccination: {
    pl: {
      title: "Po szczepieniu",
      items: [
        "W dobie po szczepieniu niemowlęta śpią zwykle dłużej (w badaniu średnio ok. godzinę więcej). Wcześniejszy sen i dłuższe drzemki są w porządku.",
        "Gorsza noc lub marudzenie przez dzień–dwa to częsta reakcja.",
      ],
    },
    en: {
      title: "After vaccination",
      items: [
        "In the day after vaccination babies usually sleep longer (about an hour more on average in one study). An earlier bedtime and longer naps are fine.",
        "A worse night or fussiness for a day or two is common.",
      ],
    },
  },
  medicines: {
    pl: {
      title: "Leki",
      items: [
        "Paracetamolu i ibuprofenu nie podawaj jednocześnie. Dawkę dobierz do wagi według ulotki lub zalecenia lekarza.",
        "Spanko nie podaje dawek. W razie wątpliwości zapytaj lekarza lub farmaceutę.",
      ],
    },
    en: {
      title: "Medicines",
      items: [
        "Don't give paracetamol and ibuprofen at the same time. Dose by weight as the leaflet or doctor says.",
        "Spanko doesn't give doses. If in doubt, ask a doctor or pharmacist.",
      ],
    },
  },
  unsafe: {
    pl: {
      title: "Czego nie robić",
      items: [
        "Nie podnoś materaca, bez klinów, poduszek i pochylonych leżaczków do snu.",
        "Nie kładź na boku ani na brzuchu, także przy katarze.",
        "Nie zasypiaj z chorym dzieckiem na kanapie ani w fotelu.",
        "Bez bursztynowych naszyjników i żeli na ząbkowanie z benzokainą lub lidokainą.",
      ],
    },
    en: {
      title: "What not to do",
      items: [
        "Don't raise the mattress; no wedges, pillows or inclined loungers for sleep.",
        "Don't lay them on their side or tummy, even with a blocked nose.",
        "Don't fall asleep with your sick child on a sofa or armchair.",
        "No amber necklaces and no teething gels with benzocaine or lidocaine.",
      ],
    },
  },
  back_to_plan: {
    pl: {
      title: "Powrót do planu",
      items: [
        "Cel snu i zmiany nawyków są wstrzymane na czas choroby.",
        "Wróć po ok. 2 dobach bez gorączki i ostrych objawów, zaczynając od kroku wstecz. To praktyka doradców snu, nie wynik badań.",
        "Przez kilka nocy po chorobie gorszy sen jest normalny.",
      ],
    },
    en: {
      title: "Back to the plan",
      items: [
        "Your sleep goal and habit changes are paused while your child is ill.",
        "Resume after about 2 days without fever or acute symptoms, starting one step back. This is sleep-consultant practice, not research.",
        "A few rougher nights after illness are normal.",
      ],
    },
  },
  on_the_go_naps: {
    pl: {
      title: "Drzemki w drodze",
      items: [
        "Drzemka w wózku czy w aucie liczy się tak samo jak w łóżeczku. Nie ma dowodów, że jest gorsza.",
        "Krótkie drzemki w drodze są normalne, dziś nie oceniamy ich jako problemu.",
        "Bardzo krótka drzemka (poniżej 20 min) tylko trochę odświeża, więc kolejne okno czuwania będzie krótsze.",
        "Po dniu z małą ilością drzemek proponujemy wcześniejszy sen nocny. To częsta praktyka, badań jest mało.",
      ],
    },
    en: {
      title: "Naps on the go",
      items: [
        "A nap in the pram or car counts just like a nap in the cot. There's no evidence it's worse.",
        "Short naps on the go are normal; today we don't treat them as a problem.",
        "A very short nap (under 20 min) refreshes only a little, so the next awake time will be shorter.",
        "After a day with little nap sleep we suggest an earlier bedtime. It's common practice with little research behind it.",
      ],
    },
  },
  car_seat: {
    pl: {
      title: "Fotelik samochodowy",
      items: [
        "Fotelik jest do jazdy: dziecko śpi przypięte, z dociągniętymi pasami. Po dotarciu przenieś je na płaską powierzchnię.",
        "Nie zostawiaj śpiącego dziecka w foteliku poza autem bez nadzoru.",
        "Najmłodsze (poniżej 4 mies. i wcześniaki): przy dłuższej jeździe rób przerwy i sprawdzaj dziecko co ok. 30 minut, najlepiej z drugim dorosłym obok. Gdy główka opada na klatkę piersiową, zatrzymaj się.",
        "„Zasada 2 godzin” nie wynika z badań. Ważne są regularne przerwy.",
      ],
    },
    en: {
      title: "Car seat",
      items: [
        "Car seats are for travel: buckled in with straps snug. When you arrive, move your baby to a flat surface.",
        "Don't leave a sleeping baby in a car seat outside the car unsupervised.",
        "Youngest babies (under 4 months and preterm): take breaks on longer drives and check every 30 minutes or so, ideally with a second adult beside them. If the head drops onto the chest, stop.",
        "The “2-hour rule” isn't based on research. Regular breaks are what matter.",
      ],
    },
  },
  stroller: {
    pl: {
      title: "Wózek",
      items: [
        "Nie przykrywaj gondoli kocykiem ani pieluszką, bo grozi to przegrzaniem. Używaj przypinanej osłony i sprawdzaj kark dziecka.",
        "Dla noworodka gondola z płaskim leżeniem.",
      ],
    },
    en: {
      title: "Pram",
      items: [
        "Don't cover the pram with a blanket or muslin, it can cause overheating. Use a clip-on shade and check the back of your baby's neck.",
        "For a newborn, use a lie-flat carrycot.",
      ],
    },
  },
  carrier: {
    pl: {
      title: "Nosidło i chusta",
      items: [
        "Ciasno, zawsze w zasięgu wzroku, na wysokości pocałunku, broda z dala od klatki piersiowej (co najmniej szerokość palca), plecy podparte.",
      ],
    },
    en: {
      title: "Carrier and sling",
      items: [
        "Tight, in view at all times, close enough to kiss, chin off the chest (at least a finger's width), back supported.",
      ],
    },
  },
  new_place: {
    pl: {
      title: "Nowe miejsce",
      items: [
        "Pierwsze 1–2 noce w nowym miejscu mogą być gorsze i to normalne.",
        "Zabierz domowe sygnały snu: śpiworek, biały szum, zaciemnienie (przytulankę dopiero od 1. roku).",
        "Łóżeczko turystyczne tylko z oryginalnym, płaskim materacem, bez dodatkowych materacyków.",
      ],
    },
    en: {
      title: "A new place",
      items: [
        "The first 1–2 nights somewhere new can be rougher, and that's normal.",
        "Bring home sleep cues: sleeping bag, white noise, blackout (a comfort toy only from 1 year).",
        "Travel cot only with its original flat mattress, no extra padding.",
      ],
    },
  },
};

/** Objawy, przy których dzwonimy po pogotowie (NHS 999, czerwona kolumna NICE NG143). */
export const EMERGENCY_SIGNS: Localized<readonly string[]> = {
  pl: [
    "Trudno je obudzić albo po obudzeniu nie zostaje przytomne",
    "Wysypka, która nie blednie pod naciśniętą szklanką",
    "Trudności z oddychaniem: chrząkanie, wciąganie brzucha pod żebra, bardzo szybki oddech",
    "Sina, szara lub marmurkowa skóra albo usta",
    "Drgawki",
    "Sztywny kark lub razi je światło",
    "Bardzo zimne dłonie i stopy",
    "Słaby, piskliwy lub nieustający płacz",
    "Nie reaguje jak zwykle albo nie chce jeść",
    "Uwypuklone ciemiączko",
  ],
  en: [
    "Hard to wake, or doesn't stay awake once woken",
    "A rash that doesn't fade when you press a glass on it",
    "Breathing difficulty: grunting, sucking in under the ribs, very fast breathing",
    "Blue, grey or blotchy skin or lips",
    "A seizure",
    "Stiff neck or bothered by light",
    "Unusually cold hands and feet",
    "Weak, high-pitched or continuous crying",
    "Not responding as usual or not interested in feeding",
    "Bulging soft spot on the head",
  ],
};

/** Objawy, przy których trzeba pilnie do lekarza (NICE NG143, NHS 111, AAP — ostrzejszy próg). */
export const URGENT_SIGNS: Localized<readonly string[]> = {
  pl: [
    "3–6 mies.: temperatura 39°C lub wyższa",
    "Gorączka dłużej niż 24 godziny u dziecka poniżej 2 lat (u starszego ponad 3 doby) albo powyżej 40°C",
    "Brak mokrej pieluchy przez 8 godzin, zapadnięte oczy, płacz bez łez",
    "Wysypka razem z gorączką",
    "Nadal wygląda na chore po obniżeniu gorączki",
  ],
  en: [
    "3–6 months: temperature of 39°C or higher",
    "Fever for more than 24 hours under 2 years (over 3 days if older), or above 40°C",
    "No wet nappy for 8 hours, sunken eyes, crying without tears",
    "A rash together with fever",
    "Still looks unwell after the fever comes down",
  ],
};

export const GUIDANCE_COPY: Localized<{
  readonly illnessTitle: string;
  readonly onTheGoTitle: string;
  readonly redFlagsTitle: string;
  readonly emergencyTitle: string;
  readonly urgentTitle: string;
  readonly youngInfantFever: string;
  readonly under6MonthsIbuprofen: string;
  readonly whereToGo: string;
  readonly wakeCheckQuestion: string;
  readonly wakeCheckYes: string;
  readonly wakeCheckNo: string;
  readonly wakeCheckOk: string;
  readonly wakeCheckAlarm: string;
  readonly sources: string;
  readonly sourcesOnTheGo: string;
}> = {
  pl: {
    illnessTitle: "Choroba: jak pomóc w spaniu",
    onTheGoTitle: "W drodze: drzemki i bezpieczeństwo",
    redFlagsTitle: "Kiedy wezwać pomoc",
    emergencyTitle: "Dzwoń na 112, gdy:",
    urgentTitle: "Pilnie do lekarza (jeszcze dziś), gdy:",
    youngInfantFever:
      "Dziecko poniżej 3 mies. z temperaturą 38°C lub wyższą: od razu SOR lub nocna i świąteczna opieka, nie czekaj do rana.",
    under6MonthsIbuprofen: "Poniżej 6 mies. o ibuprofen zapytaj lekarza lub farmaceutę.",
    whereToGo:
      "Wieczorem, w nocy i w święta: nocna i świąteczna opieka zdrowotna (także teleporada). Infolinia NFZ: 800 190 590.",
    wakeCheckQuestion: "Długi sen w chorobie. Czy dziecko łatwo się wybudza i zostaje przytomne?",
    wakeCheckYes: "Tak",
    wakeCheckNo: "Nie",
    wakeCheckOk: "Dobrze. W chorobie dłuższy sen jest w porządku, zaglądaj do dziecka.",
    wakeCheckAlarm: "To może być stan nagły. Zadzwoń na 112.",
    sources:
      "Na podstawie NICE, NHS, AAP i Lullaby Trust. Nie zastępuje porady lekarza; gdy coś Cię niepokoi, dzwoń.",
    sourcesOnTheGo:
      "Na podstawie zaleceń AAP 2022, Lullaby Trust i badań bezpieczeństwa fotelików.",
  },
  en: {
    illnessTitle: "Illness: helping your child sleep",
    onTheGoTitle: "On the go: naps and safety",
    redFlagsTitle: "When to get help",
    emergencyTitle: "Call 112 or your local emergency number if:",
    urgentTitle: "See a doctor urgently (today) if:",
    youngInfantFever:
      "Baby under 3 months with a temperature of 38°C or higher: go to A&E or an out-of-hours service now, don't wait until morning.",
    under6MonthsIbuprofen: "Under 6 months, ask a doctor or pharmacist before ibuprofen.",
    whereToGo: "Evenings, nights and holidays: call your out-of-hours medical service.",
    wakeCheckQuestion: "Long sleep while ill. Does your child wake easily and stay awake?",
    wakeCheckYes: "Yes",
    wakeCheckNo: "No",
    wakeCheckOk: "Good. Longer sleep is fine during illness, keep checking on them.",
    wakeCheckAlarm: "This may be an emergency. Call 112 or your local emergency number.",
    sources:
      "Based on NICE, NHS, AAP and Lullaby Trust. Not a substitute for medical advice; if you're worried, call.",
    sourcesOnTheGo: "Based on AAP 2022, Lullaby Trust and car seat safety research.",
  },
};
