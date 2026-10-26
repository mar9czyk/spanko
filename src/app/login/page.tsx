"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/messages";
import { type DevLoginRole, IS_DEV_LOGIN_ENABLED } from "@/lib/dev-auth";
import { pb, signInWithGoogle } from "@/lib/pocketbase";

const INTRO_POINTS: readonly { icon: string; titleKey: MessageKey; textKey: MessageKey }[] = [
  { icon: "🌙", titleKey: "login.intro.windows.title", textKey: "login.intro.windows.text" },
  { icon: "🔋", titleKey: "login.intro.battery.title", textKey: "login.intro.battery.text" },
  { icon: "👶", titleKey: "login.intro.thumb.title", textKey: "login.intro.thumb.text" },
];

const DEV_FAMILY_BUTTONS: readonly { role: DevLoginRole; labelKey: MessageKey }[] = [
  { role: "family-newborn", labelKey: "login.devFamilyNewborn" },
  { role: "family-infant", labelKey: "login.devFamilyInfant" },
  { role: "family-infant-partner", labelKey: "login.devFamilyInfantPartner" },
  { role: "family-toddler", labelKey: "login.devFamilyToddler" },
];

/**
 * Ekran logowania: Google OAuth oraz (tylko lokalnie w development) logowanie testowe.
 */
export default function LoginPage(): ReactNode {
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("login.failed"));
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
      setError(data.error ?? t("login.devFailed"));
      return;
    }
    pb.authStore.save(data.token, data.record);
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-ink flex justify-center">
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative flex min-h-screen w-full max-w-md flex-col px-6 pt-16 pb-10 overflow-hidden"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-600/20 blur-3xl"
        />
        <header className="relative flex flex-col items-center text-center">
          <Image
            src="/icons/icon-192.png"
            alt={t("login.logoAlt")}
            width={96}
            height={96}
            priority
            unoptimized
            className="rounded-3xl shadow-lg shadow-violet-900/40"
          />
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-amber-200">Spanko</h1>
          <p className="mt-2 text-sm text-slate-400">{t("login.tagline")}</p>
        </header>

        <ul className="relative mt-10 flex flex-col gap-3">
          {INTRO_POINTS.map((point) => (
            <li
              key={point.titleKey}
              className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4"
            >
              <span className="text-2xl" aria-hidden>
                {point.icon}
              </span>
              <div>
                <p className="text-sm font-medium text-ink">{t(point.titleKey)}</p>
                <p className="text-xs text-slate-400">{t(point.textKey)}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="relative mt-auto flex flex-col gap-3 pt-10">
          {error && (
            <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={handleGoogle}
            className="h-14 rounded-2xl bg-violet-600 text-base font-medium text-white shadow-lg shadow-violet-900/40 active:scale-[0.98] transition"
          >
            {t("login.google")}
          </button>
          {IS_DEV_LOGIN_ENABLED && (
            <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-amber-400/30 p-3">
              <p className="text-center text-xs uppercase tracking-wider text-amber-300/70">
                {t("login.devMode")}
              </p>
              <button
                type="button"
                onClick={() => handleDev("user")}
                className="h-12 rounded-xl border border-amber-400/60 text-sm text-amber-200 active:scale-[0.98] transition"
              >
                {t("login.devUser")}
              </button>
              {DEV_FAMILY_BUTTONS.map(({ role, labelKey }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleDev(role)}
                  className="h-11 rounded-xl border border-amber-400/30 text-xs text-amber-200/80 active:scale-[0.98] transition"
                >
                  {t(labelKey)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleDev("admin")}
                className="h-11 rounded-xl border border-amber-400/30 text-xs text-amber-200/80 active:scale-[0.98] transition"
              >
                {t("login.devAdmin")}
              </button>
            </div>
          )}
        </div>
      </motion.main>
    </div>
  );
}
