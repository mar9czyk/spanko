"use client";

import { useEffect, useState } from "react";
import { type AuthMethods, DEFAULT_AUTH_METHODS } from "@/lib/authMethods";

/**
 * Pobiera włączone metody logowania i rejestracji dla ekranów logowania.
 *
 * @returns {AuthMethods | null} Metody; null w trakcie ładowania, wszystkie przy błędzie odczytu
 */
export function useAuthMethods(): AuthMethods | null {
  const [methods, setMethods] = useState<AuthMethods | null>(null);

  useEffect(() => {
    fetch("/api/auth/methods")
      .then((response) => (response.ok ? (response.json() as Promise<AuthMethods>) : null))
      .catch(() => null)
      .then((loaded) => setMethods(loaded ?? DEFAULT_AUTH_METHODS));
  }, []);

  return methods;
}
