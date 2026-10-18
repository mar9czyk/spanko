import { describe, expect, it } from "vitest";
import {
  formatDateToCalendarString,
  getPreviousCalendarDateString,
  type NightSleepReference,
  parseTimestampToMilliseconds,
  resolvePhysiologicalDate,
} from "../physiologicalDay";

describe("resolvePhysiologicalDate", () => {
  const mondayNightSleep: NightSleepReference = {
    physiologicalDate: "2026-10-19",
    fellAsleepAt: new Date("2026-10-19T19:30:00+02:00"),
    wokeUpAt: new Date("2026-10-20T06:30:00+02:00"),
  };

  const ongoingMondayNightSleep: NightSleepReference = {
    physiologicalDate: "2026-10-19",
    fellAsleepAt: new Date("2026-10-19T19:30:00+02:00"),
    wokeUpAt: null,
  };

  it("przypisuje wpis przed północą do doby poniedziałkowej", () => {
    const beforeMidnightTimestamp = new Date("2026-10-19T23:15:00+02:00");

    const withActiveSleep = resolvePhysiologicalDate({
      eventTimestamp: beforeMidnightTimestamp,
      activeOrRecentNightSleep: mondayNightSleep,
    });
    expect(withActiveSleep).toBe("2026-10-19");

    const withoutActiveSleep = resolvePhysiologicalDate({
      eventTimestamp: beforeMidnightTimestamp,
    });
    expect(withoutActiveSleep).toBe("2026-10-19");
  });

  it("przypisuje wpis o 02:15 w nocy w trakcie trwającego snu do doby poniedziałkowej", () => {
    const nightWakingTimestamp = new Date("2026-10-20T02:15:00+02:00");

    const withOngoingSleep = resolvePhysiologicalDate({
      eventTimestamp: nightWakingTimestamp,
      activeOrRecentNightSleep: ongoingMondayNightSleep,
    });
    expect(withOngoingSleep).toBe("2026-10-19");

    const withCompletedReference = resolvePhysiologicalDate({
      eventTimestamp: nightWakingTimestamp,
      activeOrRecentNightSleep: mondayNightSleep,
    });
    expect(withCompletedReference).toBe("2026-10-19");
  });

  it("stosuje fallback dla wpisu o 02:15 w nocy bez referencji do snu nocnego", () => {
    const nightWakingTimestamp = new Date("2026-10-20T02:15:00+02:00");

    const result = resolvePhysiologicalDate({
      eventTimestamp: nightWakingTimestamp,
      activeOrRecentNightSleep: null,
    });
    expect(result).toBe("2026-10-19");
  });

  it("przypisuje moment zakończenia snu nocnego o 06:30 do doby poniedziałkowej", () => {
    const morningWakeUpTime = new Date("2026-10-20T06:30:00+02:00");

    const result = resolvePhysiologicalDate({
      eventTimestamp: morningWakeUpTime,
      activeOrRecentNightSleep: mondayNightSleep,
    });
    expect(result).toBe("2026-10-19");
  });

  it("otwiera nową dobę wtorkową dla wpisu po porannej pobudce o 06:45", () => {
    const afterMorningWakeUpTime = new Date("2026-10-20T06:45:00+02:00");

    const withNightSleepReference = resolvePhysiologicalDate({
      eventTimestamp: afterMorningWakeUpTime,
      activeOrRecentNightSleep: mondayNightSleep,
    });
    expect(withNightSleepReference).toBe("2026-10-20");

    const withoutNightSleepReference = resolvePhysiologicalDate({
      eventTimestamp: afterMorningWakeUpTime,
    });
    expect(withoutNightSleepReference).toBe("2026-10-20");
  });

  it("rozpoczyna nową dobę po wczesnej pobudce o 05:30 nawet przed godziną odcięcia 06:00", () => {
    const earlyWakeUpSleep: NightSleepReference = {
      physiologicalDate: "2026-10-19",
      fellAsleepAt: new Date("2026-10-19T19:30:00+02:00"),
      wokeUpAt: new Date("2026-10-20T05:30:00+02:00"),
    };
    const eventAtBreakfast = new Date("2026-10-20T05:45:00+02:00");

    const result = resolvePhysiologicalDate({
      eventTimestamp: eventAtBreakfast,
      activeOrRecentNightSleep: earlyWakeUpSleep,
    });
    expect(result).toBe("2026-10-20");
  });

  it("poprawnie obsługuje różne formaty wejściowe czasu (string ISO oraz milisekundy)", () => {
    const timestampMs = new Date("2026-10-20T14:00:00+02:00").getTime();
    const resultFromMs = resolvePhysiologicalDate({
      eventTimestamp: timestampMs,
    });
    expect(resultFromMs).toBe("2026-10-20");

    const date = new Date("2026-10-20T10:00:00+02:00");
    expect(parseTimestampToMilliseconds(date)).toBe(date.getTime());
    expect(formatDateToCalendarString(date)).toBe("2026-10-20");
    expect(getPreviousCalendarDateString(date)).toBe("2026-10-19");
  });

  it("liczy dobę według strefy Europe/Warsaw niezależnie od strefy procesu (np. serwer w UTC)", () => {
    // 01:30 czasu polskiego (CEST) = 23:30 UTC poprzedniego dnia
    const nightWaking = new Date("2026-10-19T23:30:00Z");
    expect(resolvePhysiologicalDate({ eventTimestamp: nightWaking })).toBe("2026-10-19");
    // 08:00 czasu polskiego = 06:00 UTC
    const morning = new Date("2026-10-20T06:00:00Z");
    expect(resolvePhysiologicalDate({ eventTimestamp: morning })).toBe("2026-10-20");
    // ta sama chwila w innej strefie daje inną dobę
    expect(resolvePhysiologicalDate({ eventTimestamp: nightWaking, timeZone: "UTC" })).toBe(
      "2026-10-19",
    );
    expect(
      resolvePhysiologicalDate({ eventTimestamp: "2026-10-20T00:30:00Z", timeZone: "UTC" }),
    ).toBe("2026-10-19");
    expect(resolvePhysiologicalDate({ eventTimestamp: "2026-10-20T00:30:00Z" })).toBe("2026-10-19");
  });

  it("poprawnie wyznacza poprzedni dzień na granicy zmiany czasu", () => {
    // 2026-10-25 02:30 CET (po cofnięciu zegara) -> poprzedni dzień to 2026-10-24
    const afterDstEnd = new Date("2026-10-25T01:30:00Z");
    expect(getPreviousCalendarDateString(afterDstEnd)).toBe("2026-10-24");
  });
});
