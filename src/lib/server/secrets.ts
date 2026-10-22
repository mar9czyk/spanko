import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const SECRETS_KEY_ENV = "SPANKO_SECRETS_KEY";
export const OPENROUTER_SECRET_NAME = "openrouter_api_key";
export const SECRET_FORMAT_VERSION = "v1";
export const MASTER_KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_SUFFIX_LENGTH = 4;
const KEY_PREFIX_LENGTH = 5;

export class SecretsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretsError";
  }
}

/**
 * Wczytuje klucz główny (32 bajty w base64) ze zmiennej środowiskowej `SPANKO_SECRETS_KEY`.
 *
 * @param {NodeJS.ProcessEnv} [env] - Źródło zmiennych (domyślnie `process.env`)
 * @returns {Buffer | null} Klucz albo null, gdy zmienna nie jest ustawiona
 * @throws {SecretsError} Gdy zmienna jest ustawiona, ale nie ma 32 bajtów w base64
 */
export function loadMasterKey(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Buffer | null {
  const raw = env[SECRETS_KEY_ENV]?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== MASTER_KEY_BYTES) {
    throw new SecretsError(`${SECRETS_KEY_ENV} musi mieć ${MASTER_KEY_BYTES} bajtów w base64.`);
  }
  return key;
}

/**
 * Szyfruje sekret (AES-256-GCM, losowe IV, AAD = nazwa sekretu).
 *
 * @param {string} name - Nazwa sekretu (wiąże szyfrogram z polem)
 * @param {string} plain - Wartość jawna
 * @param {Buffer} masterKey - Klucz główny
 * @returns {string} Ładunek `v1:<iv>:<tag>:<dane>` (base64)
 */
export function encryptSecret(name: string, plain: string, masterKey: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", masterKey, iv);
  cipher.setAAD(Buffer.from(name, "utf8"));
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    SECRET_FORMAT_VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    data.toString("base64"),
  ].join(":");
}

/**
 * Odszyfrowuje sekret zapisany przez `encryptSecret`.
 *
 * @param {string} name - Nazwa sekretu użyta przy szyfrowaniu
 * @param {string} payload - Ładunek `v1:<iv>:<tag>:<dane>`
 * @param {Buffer} masterKey - Klucz główny
 * @throws {SecretsError} Zły format, zły klucz główny albo zmieniony szyfrogram/nazwa
 * @returns {string} Wartość jawna
 */
export function decryptSecret(name: string, payload: string, masterKey: Buffer): string {
  const [version, ivB64, tagB64, dataB64, ...rest] = payload.split(":");
  if (
    version !== SECRET_FORMAT_VERSION ||
    !ivB64 ||
    !tagB64 ||
    dataB64 === undefined ||
    rest.length
  ) {
    throw new SecretsError("Nieznany format zaszyfrowanego sekretu.");
  }
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new SecretsError("Nieznany format zaszyfrowanego sekretu.");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", masterKey, iv);
    decipher.setAAD(Buffer.from(name, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new SecretsError(
      "Nie udało się odszyfrować sekretu (zły klucz główny lub zmieniony zapis).",
    );
  }
}

/**
 * Zwraca ostatnie znaki klucza do wyświetlenia w panelu.
 *
 * @param {string} key - Klucz jawny
 * @returns {string} Końcówka klucza
 */
export function keySuffix(key: string): string {
  return key.slice(-KEY_SUFFIX_LENGTH);
}

/**
 * Maskuje klucz: początek (`sk-or`) i końcówka, np. `sk-or-…a1b2`.
 *
 * @param {string} key - Klucz jawny
 * @returns {string} Wersja zamaskowana
 */
export function maskKey(key: string): string {
  return `${key.slice(0, KEY_PREFIX_LENGTH)}…${keySuffix(key)}`;
}

/**
 * Maskuje samą końcówkę zapisaną w bazie (bez dostępu do pełnego klucza).
 *
 * @param {string} suffix - Ostatnie znaki klucza
 * @returns {string} Wersja zamaskowana
 */
export function maskSuffix(suffix: string): string {
  return `sk-or-…${suffix}`;
}
