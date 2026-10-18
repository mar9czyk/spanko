"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { type DevLoginRole, IS_DEV_LOGIN_ENABLED } from "@/lib/dev-auth";
import { pb, signInWithGoogle } from "@/lib/pocketbase";

/**
 * Ekran logowania: Google OAuth oraz (tylko lokalnie w development) logowanie testowe.
 */
export default function LoginPage(): ReactNode {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Logowanie nie powiodło się");
    }
  };

  const handleDev = async (role: DevLoginRole) => {
    const response = await fetch("/api/dev/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = (await response.json()) as { token?: string; record?: never; error?: string };
    if (!response.ok || !data.token) {
      setError(data.error ?? "Logowanie DEV nie powiodło się");
      return;
    }
    pb.authStore.save(data.token, data.record);
    router.push("/dashboard");
  };

  return (
    <main className="flex min-h-screen flex-col justify-end gap-3 pb-8">
      <h1 className="text-2xl font-semibold text-amber-200">Spanko</h1>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <button
        type="button"
        onClick={handleGoogle}
        className="h-14 rounded-2xl bg-violet-600 text-base font-medium text-white"
      >
        Zaloguj przez Google
      </button>
      {IS_DEV_LOGIN_ENABLED && (
        <>
          <button
            type="button"
            onClick={() => handleDev("user")}
            className="h-14 rounded-2xl border border-amber-400/60 text-base text-amber-200"
          >
            Zaloguj jako testowy użytkownik (DEV)
          </button>
          <button
            type="button"
            onClick={() => handleDev("admin")}
            className="h-12 rounded-2xl border border-amber-400/30 text-sm text-amber-200/80"
          >
            Zaloguj jako testowy admin (DEV)
          </button>
        </>
      )}
    </main>
  );
}
