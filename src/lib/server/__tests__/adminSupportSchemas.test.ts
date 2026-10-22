import { describe, expect, it } from "vitest";
import { translateDynamicWithOverrides } from "@/i18n/translate";
import {
  AnnouncementCreateSchema,
  AnnouncementPatchSchema,
  AppContentUpsertSchema,
  FeatureFlagCreateSchema,
  FeatureFlagPatchSchema,
  InviteActionSchema,
  SleepFixSchema,
} from "../adminSchemasSupport";

describe("SleepFixSchema", () => {
  it("wymaga jawnego confirm: true i poprawnej daty ISO", () => {
    expect(
      SleepFixSchema.safeParse({ wokeUpAt: "2026-10-18T06:30:00Z", confirm: true }).success,
    ).toBe(true);
    expect(SleepFixSchema.safeParse({ wokeUpAt: "2026-10-18T06:30:00Z" }).success).toBe(false);
    expect(
      SleepFixSchema.safeParse({ wokeUpAt: "2026-10-18T06:30:00Z", confirm: false }).success,
    ).toBe(false);
    expect(SleepFixSchema.safeParse({ wokeUpAt: "jutro", confirm: true }).success).toBe(false);
  });
});

describe("InviteActionSchema", () => {
  it("akceptuje tylko revoke i regenerate", () => {
    expect(InviteActionSchema.safeParse({ action: "revoke" }).success).toBe(true);
    expect(InviteActionSchema.safeParse({ action: "regenerate" }).success).toBe(true);
    expect(InviteActionSchema.safeParse({ action: "delete" }).success).toBe(false);
  });
});

describe("AppContentUpsertSchema", () => {
  it("dopuszcza polskie znaki w kluczu i odrzuca spacje oraz znaki specjalne", () => {
    expect(
      AppContentUpsertSchema.safeParse({ key: "tag.teething", value_pl: "ząbki" }).success,
    ).toBe(true);
    expect(AppContentUpsertSchema.safeParse({ key: "tag z spacją", value_pl: "x" }).success).toBe(
      false,
    );
    expect(AppContentUpsertSchema.safeParse({ key: "a/b", value_pl: "x" }).success).toBe(false);
    expect(AppContentUpsertSchema.safeParse({ key: "k", value_pl: "x".repeat(2001) }).success).toBe(
      false,
    );
  });
});

describe("schematy ogłoszeń", () => {
  it("tworzenie ma domyślny poziom info i aktywność, wymaga treści", () => {
    const parsed = AnnouncementCreateSchema.parse({ message: "Przerwa techniczna" });
    expect(parsed).toMatchObject({ level: "info", active: true });
    expect(AnnouncementCreateSchema.safeParse({ message: "  " }).success).toBe(false);
    expect(AnnouncementCreateSchema.safeParse({ message: "x", level: "danger" }).success).toBe(
      false,
    );
  });

  it("PATCH wymaga co najmniej jednego pola i akceptuje null dla dat", () => {
    expect(AnnouncementPatchSchema.safeParse({}).success).toBe(false);
    expect(AnnouncementPatchSchema.safeParse({ ends_at: null }).success).toBe(true);
    expect(AnnouncementPatchSchema.safeParse({ active: false }).success).toBe(true);
  });

  it("PATCH nie wstawia wartości domyślnych do pól, których nie podano", () => {
    expect(AnnouncementPatchSchema.parse({ message: "Nowa treść" })).toEqual({
      message: "Nowa treść",
    });
  });
});

describe("schematy flag funkcji", () => {
  it("tworzenie domyślnie wyłączone z pustym rolloutem", () => {
    expect(FeatureFlagCreateSchema.parse({ key: "goal_coach_v2" })).toMatchObject({
      enabled: false,
      rollout_household_ids: [],
    });
    expect(FeatureFlagCreateSchema.safeParse({ key: "" }).success).toBe(false);
  });

  it("PATCH nie pozwala zmieniać klucza i wymaga pola do zmiany", () => {
    expect(FeatureFlagPatchSchema.safeParse({ enabled: true }).success).toBe(true);
    expect(FeatureFlagPatchSchema.safeParse({}).success).toBe(false);
    expect(FeatureFlagPatchSchema.parse({ enabled: true, key: "inne" })).toEqual({ enabled: true });
  });

  it("PATCH samego opisu nie wyłącza flagi i nie czyści rolloutu", () => {
    expect(FeatureFlagPatchSchema.parse({ description: "nowy opis" })).toEqual({
      description: "nowy opis",
    });
  });
});

describe("translateDynamicWithOverrides", () => {
  it("używa nadpisania z bazy tylko dla polskiego i ignoruje puste wartości", () => {
    const overrides = { "tag.teething": "ząbki!", "tag.walk": "   " };
    expect(translateDynamicWithOverrides("pl", "tag.teething", "x", overrides)).toBe("ząbki!");
    expect(translateDynamicWithOverrides("en", "tag.teething", "x", overrides)).toBe("teething");
    expect(translateDynamicWithOverrides("pl", "tag.walk", "x", overrides)).toBe("spacer");
  });

  it("zwraca fallback, gdy nie ma ani nadpisania, ani tłumaczenia", () => {
    expect(translateDynamicWithOverrides("pl", "tag.nieznany", "domyślny", {})).toBe("domyślny");
  });
});
