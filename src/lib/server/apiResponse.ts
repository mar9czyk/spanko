import { NextResponse } from "next/server";
import type { z } from "zod";
import { ApiAuthError } from "@/lib/server/auth";

/**
 * Mapuje błąd handlera na odpowiedź JSON (ApiAuthError zachowuje swój kod HTTP).
 *
 * @param {unknown} error - Przechwycony błąd
 * @param {string} fallbackMessage - Komunikat dla nieoczekiwanych błędów (HTTP 500)
 * @returns {NextResponse} Odpowiedź z polami `success: false` i `error`
 */
export function toErrorResponse(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : fallbackMessage;
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

/**
 * Parsuje i waliduje ciało JSON żądania schematem zod.
 *
 * @param {Request} request - Żądanie HTTP
 * @param {z.ZodType<T>} schema - Schemat zod
 * @throws {ApiAuthError} 400 przy niepoprawnym JSON-ie lub niezgodności ze schematem
 * @returns {Promise<T>} Zwalidowane dane
 */
export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiAuthError("Niepoprawne ciało żądania (oczekiwano JSON).", 400);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; ");
    throw new ApiAuthError(`Niepoprawne dane: ${details}`, 400);
  }
  return parsed.data;
}
