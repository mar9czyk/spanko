import { describe, expect, it } from "vitest";
import {
  hasSleepEnvironment,
  isContactSleepPlace,
  isMotionSleepPlace,
  parseSleepEnvironment,
  resolveCarSeatSafetyAdvice,
  resolveContactNapSafetyAdvice,
  type SleepEnvironment,
  sleepEnvironmentAdvice,
  sleepEnvironmentCodes,
} from "../sleep-environment";

const codes = (env: SleepEnvironment | null, age = 100) => sleepEnvironmentCodes(env, age);

describe("sleepEnvironmentAdvice", () => {
  it("nie zwraca nic bez profilu ani przy pustym profilu (brak danych, nie „dobrze”)", () => {
    expect(codes(null)).toEqual([]);
    expect(codes({})).toEqual([]);
  });

  it("łóżko rodziców: zasady bezpiecznego współspania do 12. mies., potem bez flagi", () => {
    expect(codes({ nightPlace: "parents_bed" }, 100)).toContain("ENV_PARENTS_BED_SAFETY");
    expect(codes({ napPlace: "parents_bed" }, 100)).toContain("ENV_PARENTS_BED_SAFETY");
    expect(codes({ nightPlace: "parents_bed" }, 400)).not.toContain("ENV_PARENTS_BED_SAFETY");
  });

  it("kosz Mojżesza: przeniesienie do łóżeczka bez liczb", () => {
    const [advice] = sleepEnvironmentAdvice({ nightPlace: "moses_basket" }, 30, "pl");
    expect(advice?.code).toBe("ENV_MOSES_BASKET_OUTGROW");
    expect(advice?.text).not.toMatch(/\d/);
  });

  it("palenie jest flagą bezpieczeństwa i stoi przed poradami", () => {
    const list = sleepEnvironmentAdvice(
      { smokingAtHome: true, nightLight: "normal", blackout: "no" },
      100,
      "en",
    );
    expect(list[0]?.code).toBe("ENV_SMOKE_SAFETY");
    expect(list.map((a) => a.kind)).toEqual(["safety", "tip", "context", "context"]);
  });

  it("niepewny biały szum → głośność i odległość; pewny → nic", () => {
    expect(codes({ whiteNoise: "yes_unsure" })).toContain("ENV_WHITE_NOISE_VOLUME");
    expect(codes({ whiteNoise: "yes_safe" })).toEqual([]);
  });

  it("ciepło → przegrzanie; chłodno → warstwa; ok/nie wiem → nic", () => {
    expect(codes({ roomTemp: "warm" })).toContain("ENV_HEAT_SAFETY");
    expect(codes({ roomTemp: "cool" })).toContain("ENV_COOL_ROOM");
    expect(codes({ roomTemp: "ok" })).toEqual([]);
    expect(codes({ roomTemp: "unknown" })).toEqual([]);
  });

  it("rolety i ekrany to kontekst przypisany do diagnozy", () => {
    const list = sleepEnvironmentAdvice(
      { blackout: "partial", screensBeforeBed: "usually" },
      100,
      "pl",
    );
    expect(list.map((a) => [a.code, a.diagnosis])).toEqual([
      ["ENV_BLACKOUT_EARLY_WAKING", "early_waking"],
      ["ENV_EVENING_SCREEN", "bedtime_resistance"],
    ]);
  });

  it("ma teksty w obu językach dla każdej reguły", () => {
    const all: SleepEnvironment = {
      nightPlace: "parents_bed",
      napPlace: "stroller",
      blackout: "no",
      nightLight: "normal",
      whiteNoise: "yes_unsure",
      roomTemp: "warm",
      smokingAtHome: true,
      screensBeforeBed: "usually",
    };
    const pl = sleepEnvironmentAdvice(all, 100, "pl");
    const en = sleepEnvironmentAdvice(all, 100, "en");
    expect(pl.length).toBe(en.length);
    expect(pl.every((a) => a.text.length > 20)).toBe(true);
  });
});

describe("parseSleepEnvironment", () => {
  it("pomija nieznane wartości i złe typy", () => {
    expect(
      parseSleepEnvironment({ nightPlace: "crib", room: "attic", smokingAtHome: "yes", x: 1 }),
    ).toEqual({ nightPlace: "crib" });
    expect(parseSleepEnvironment(null)).toEqual({});
  });

  it("hasSleepEnvironment wykrywa choć jedną odpowiedź", () => {
    expect(hasSleepEnvironment({})).toBe(false);
    expect(hasSleepEnvironment({ smokingAtHome: false })).toBe(true);
  });
});

describe("miejsce w ruchu: wózek i auto", () => {
  it("auto nie jest zwykłym miejscem snu w profilu", () => {
    expect(parseSleepEnvironment({ napPlace: "car_seat" })).toEqual({});
    expect(parseSleepEnvironment({ napPlace: "stroller" })).toEqual({ napPlace: "stroller" });
  });

  it("wózek i auto to ruch, łóżeczko nie", () => {
    expect(isMotionSleepPlace("stroller")).toBe(true);
    expect(isMotionSleepPlace("car_seat")).toBe(true);
    expect(isMotionSleepPlace("crib")).toBe(false);
    expect(isMotionSleepPlace(undefined)).toBe(false);
  });

  it("porada o kontroli co 30 min tylko w foteliku poniżej 4 mies.", () => {
    expect(resolveCarSeatSafetyAdvice("car_seat", 60, "pl")).toContain("30 minut");
    expect(resolveCarSeatSafetyAdvice("car_seat", 60, "en")).toContain("30 minutes");
    expect(resolveCarSeatSafetyAdvice("car_seat", 120, "pl")).toBeNull();
    expect(resolveCarSeatSafetyAdvice("stroller", 60, "pl")).toBeNull();
    expect(resolveCarSeatSafetyAdvice(undefined, 60, "pl")).toBeNull();
  });
});

describe("drzemka kontaktowa", () => {
  it("nie jest ruchem, ale jest rozpoznawana", () => {
    expect(isContactSleepPlace("contact")).toBe(true);
    expect(isContactSleepPlace("crib")).toBe(false);
    expect(isMotionSleepPlace("contact")).toBe(false);
  });

  it("w profilu dla drzemek tak, dla nocy nie", () => {
    expect(parseSleepEnvironment({ napPlace: "contact" })).toEqual({ napPlace: "contact" });
    expect(parseSleepEnvironment({ nightPlace: "contact" })).toEqual({});
  });

  it("porada bezpieczeństwa tylko do 12. mies.", () => {
    expect(resolveContactNapSafetyAdvice("contact", 60, "pl")).toContain("przytomna");
    expect(resolveContactNapSafetyAdvice("contact", 60, "en")).toContain("awake");
    expect(resolveContactNapSafetyAdvice("contact", 400, "pl")).toBeNull();
    expect(resolveContactNapSafetyAdvice("crib", 60, "pl")).toBeNull();
    expect(codes({ napPlace: "contact" })).toContain("ENV_CONTACT_NAP_SAFETY");
  });
});
