import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  keySuffix,
  loadMasterKey,
  maskKey,
  SecretsError,
} from "../secrets";

const NAME = "openrouter_api_key";
const KEY = "sk-or-v1-abcdef0123456789a1b2";

describe("secrets", () => {
  it("szyfruje i odszyfrowuje w obie strony, z losowym IV", () => {
    const master = randomBytes(32);
    const first = encryptSecret(NAME, KEY, master);
    const second = encryptSecret(NAME, KEY, master);
    expect(first).not.toBe(second);
    expect(first.startsWith("v1:")).toBe(true);
    expect(first).not.toContain(KEY);
    expect(decryptSecret(NAME, first, master)).toBe(KEY);
  });

  it("zły klucz główny, zmieniony szyfrogram i inna nazwa dają błąd", () => {
    const master = randomBytes(32);
    const payload = encryptSecret(NAME, KEY, master);
    expect(() => decryptSecret(NAME, payload, randomBytes(32))).toThrow(SecretsError);
    expect(() => decryptSecret("inna_nazwa", payload, master)).toThrow(SecretsError);
    const parts = payload.split(":");
    parts[3] = Buffer.from("zmieniony").toString("base64");
    expect(() => decryptSecret(NAME, parts.join(":"), master)).toThrow(SecretsError);
    expect(() => decryptSecret(NAME, "v2:a:b:c", master)).toThrow(SecretsError);
  });

  it("loadMasterKey: brak → null, zła długość → błąd, poprawny → 32 bajty", () => {
    expect(loadMasterKey({})).toBeNull();
    expect(() => loadMasterKey({ SPANKO_SECRETS_KEY: "abc" })).toThrow(SecretsError);
    const ok = randomBytes(32).toString("base64");
    expect(loadMasterKey({ SPANKO_SECRETS_KEY: ok })?.length).toBe(32);
  });

  it("maskKey i keySuffix pokazują tylko początek i końcówkę", () => {
    expect(keySuffix(KEY)).toBe("a1b2");
    expect(maskKey(KEY)).toBe("sk-or…a1b2");
    expect(maskKey(KEY)).not.toContain("abcdef");
  });
});
