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
    fellAsleepAt: new Date(2026, 9, 19, 19, 30, 0),
    wokeUpAt: new Date(2026, 9, 20, 6, 30, 0),
  };

  const ongoingMondayNightSleep: NightSleepReference = {
    physiologicalDate: "2026-10-19",
    fellAsleepAt: new Date(2026, 9, 19, 19, 30, 0),
    wokeUpAt: null,
  };

  it("przypisuje wpis przed północą do doby poniedziałkowej", () => {
    const beforeMidnightTimestamp = new Date(2026, 9, 19, 23, 15, 0);

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
    const nightWakingTimestamp = new Date(2026, 9, 20, 2, 15, 0);

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
    const nightWakingTimestamp = new Date(2026, 9, 20, 2, 15, 0);

    const result = resolvePhysiologicalDate({
      eventTimestamp: nightWakingTimestamp,
      activeOrRecentNightSleep: null,
    });
    expect(result).toBe("2026-10-19");
  });

  it("przypisuje moment zakończenia snu nocnego o 06:30 do doby poniedziałkowej", () => {
    const morningWakeUpTime = new Date(2026, 9, 20, 6, 30, 0);

    const result = resolvePhysiologicalDate({
      eventTimestamp: morningWakeUpTime,
      activeOrRecentNightSleep: mondayNightSleep,
    });
    expect(result).toBe("2026-10-19");
  });

  it("otwiera nową dobę wtorkową dla wpisu po porannej pobudce o 06:45", () => {
    const afterMorningWakeUpTime = new Date(2026, 9, 20, 6, 45, 0);

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
      fellAsleepAt: new Date(2026, 9, 19, 19, 30, 0),
      wokeUpAt: new Date(2026, 9, 20, 5, 30, 0),
    };
    const eventAtBreakfast = new Date(2026, 9, 20, 5, 45, 0);

    const result = resolvePhysiologicalDate({
      eventTimestamp: eventAtBreakfast,
      activeOrRecentNightSleep: earlyWakeUpSleep,
    });
    expect(result).toBe("2026-10-20");
  });

  it("poprawnie obsługuje różne formaty wejściowe czasu (string ISO oraz milisekundy)", () => {
    const timestampMs = new Date(2026, 9, 20, 14, 0, 0).getTime();
    const resultFromMs = resolvePhysiologicalDate({
      eventTimestamp: timestampMs,
    });
    expect(resultFromMs).toBe("2026-10-20");

    const date = new Date(2026, 9, 20, 10, 0, 0);
    expect(parseTimestampToMilliseconds(date)).toBe(date.getTime());
    expect(formatDateToCalendarString(date)).toBe("2026-10-20");
    expect(getPreviousCalendarDateString(date)).toBe("2026-10-19");
  });
});
