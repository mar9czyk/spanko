import { describe, expect, it } from "vitest";
import {
  type AuthMethods,
  applySignupMethods,
  DEFAULT_AUTH_METHODS,
  readSignupMethods,
  validateAuthMethods,
} from "../authMethods";

const BASE_RULE = "@request.body.is_admin:isset = false && @request.body.verified:isset = false";
const methods = (login: [boolean, boolean], signup: [boolean, boolean]): AuthMethods => ({
  login: { email: login[0], google: login[1] },
  signup: { email: signup[0], google: signup[1] },
});

describe("validateAuthMethods", () => {
  it("przyjmuje wszystkie metody przy zapisanych kluczach", () => {
    expect(validateAuthMethods(DEFAULT_AUTH_METHODS, true)).toBeNull();
  });

  it("wymaga co najmniej jednej metody logowania i rejestracji", () => {
    expect(validateAuthMethods(methods([false, false], [true, false]), true)).toContain(
      "logowania",
    );
    expect(validateAuthMethods(methods([true, true], [false, false]), true)).toContain(
      "rejestracji",
    );
  });

  it("nie pozwala włączyć Google bez kluczy", () => {
    expect(validateAuthMethods(methods([true, true], [true, false]), false)).toContain("Client ID");
    expect(validateAuthMethods(methods([true, false], [true, false]), false)).toBeNull();
  });

  it("rejestracja daną metodą wymaga logowania tą metodą", () => {
    expect(validateAuthMethods(methods([false, true], [true, true]), true)).toContain("e-mailem");
    expect(validateAuthMethods(methods([true, false], [true, true]), true)).toContain("Google");
  });

  it("pozwala logować się hasłem, a rejestrować tylko przez Google", () => {
    expect(validateAuthMethods(methods([true, true], [false, true]), true)).toBeNull();
  });
});

describe("reguła rejestracji", () => {
  it("obie metody nie dodają warunku", () => {
    expect(applySignupMethods(BASE_RULE, { email: true, google: true })).toBe(BASE_RULE);
  });

  it("zapis i odczyt dają te same metody, a warunki bazowe zostają", () => {
    for (const signup of [
      { email: true, google: false },
      { email: false, google: true },
      { email: true, google: true },
    ]) {
      const rule = applySignupMethods(BASE_RULE, signup);
      expect(rule.startsWith(BASE_RULE)).toBe(true);
      expect(readSignupMethods(rule)).toEqual(signup);
    }
  });

  it("zmiana metody zastępuje poprzedni warunek zamiast go dokładać", () => {
    const emailOnly = applySignupMethods(BASE_RULE, { email: true, google: false });
    const googleOnly = applySignupMethods(emailOnly, { email: false, google: true });
    expect(googleOnly).toBe(`${BASE_RULE} && @request.context = "oauth2"`);
    expect(applySignupMethods(googleOnly, { email: true, google: true })).toBe(BASE_RULE);
  });

  it("reguła null oznacza zamkniętą rejestrację", () => {
    expect(readSignupMethods(null)).toEqual({ email: false, google: false });
  });
});
