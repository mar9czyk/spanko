"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

const PRIMARY_BUTTON =
  "h-14 w-full rounded-2xl bg-violet-600 text-base font-medium text-white shadow-lg shadow-violet-900/40 active:scale-[0.98] transition disabled:opacity-40";
const FIELD =
  "w-full rounded-xl border border-[#263348] bg-[#0B0F17] px-3 py-3 text-base text-ink placeholder:text-slate-500 focus:border-amber-500/60 focus:outline-none";

export const onboardingStyles = { primaryButton: PRIMARY_BUTTON, field: FIELD } as const;

/**
 * Wspólna rama ekranów onboardingu: ciemne tło, tytuł, opis i przyciski przy dolnej krawędzi.
 *
 * @param {object} props - Tytuł, opis, treść i opcjonalna stopka z akcjami
 * @returns {ReactNode} Ekran onboardingu
 */
export function OnboardingShell({
  title,
  subtitle,
  children,
  footer,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}): ReactNode {
  return (
    <div className="min-h-screen bg-[#0B0F17] text-ink flex justify-center">
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex min-h-screen w-full max-w-md flex-col gap-5 px-6 pt-14 pb-10"
      >
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-amber-200">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-slate-400">{subtitle}</p>}
        </header>
        <div className="flex flex-col gap-4">{children}</div>
        {footer && <div className="mt-auto flex flex-col gap-3 pt-6">{footer}</div>}
      </motion.main>
    </div>
  );
}
