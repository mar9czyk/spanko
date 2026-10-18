import { describe, expect, it } from "vitest";
import { isDevLoginEnabled, isLocalPocketBaseUrl } from "./dev-auth";

describe("isDevLoginEnabled", () => {
  it("włącza w development z lokalnym PocketBase", () => {
    expect(isDevLoginEnabled("development", "http://127.0.0.1:8090")).toBe(true);
    expect(isDevLoginEnabled("development", "http://localhost:8090")).toBe(true);
    expect(isDevLoginEnabled("development", "http://[::1]:8090")).toBe(true);
  });
  it("wyłącza w produkcji i test", () => {
    expect(isDevLoginEnabled("production", "http://127.0.0.1:8090")).toBe(false);
    expect(isDevLoginEnabled("test", "http://localhost:8090")).toBe(false);
    expect(isDevLoginEnabled(undefined, "http://localhost:8090")).toBe(false);
  });
  it("wyłącza dla zdalnego lub niepoprawnego adresu", () => {
    expect(isDevLoginEnabled("development", "https://pb.example.com")).toBe(false);
    expect(isDevLoginEnabled("development", "http://localhost.evil.com")).toBe(false);
    expect(isDevLoginEnabled("development", "nie-url")).toBe(false);
    expect(isDevLoginEnabled("development", undefined)).toBe(false);
  });
  it("isLocalPocketBaseUrl odrzuca puste", () => {
    expect(isLocalPocketBaseUrl("")).toBe(false);
  });
});
