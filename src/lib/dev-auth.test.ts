import { describe, expect, it } from "vitest";
import { isDevLoginEnabled, isLocalPocketBaseUrl, isPrivateNetworkHost } from "./dev-auth";

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

describe("isPrivateNetworkHost", () => {
  it("akceptuje loopback, LAN, Tailscale i mDNS", () => {
    for (const host of [
      "localhost:3000",
      "127.0.0.1:3000",
      "192.168.0.161:3000",
      "10.0.0.5",
      "172.20.1.2:3000",
      "100.106.23.28:3000",
      "pc.tail1234.ts.net",
      "laptop.local:3000",
    ]) {
      expect(isPrivateNetworkHost(host)).toBe(true);
    }
  });
  it("odrzuca hosty publiczne i puste", () => {
    for (const host of [
      "spanko.example.com",
      "8.8.8.8",
      "172.32.0.1",
      "100.128.0.1",
      "abc.ngrok.app",
      "",
      null,
    ]) {
      expect(isPrivateNetworkHost(host)).toBe(false);
    }
  });
});
