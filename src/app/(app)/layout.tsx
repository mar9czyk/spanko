"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useOnboardingGuard } from "@/components/onboarding/useOnboardingGuard";
import { useI18n } from "@/i18n/I18nProvider";
import { IS_DEV_LOGIN_ENABLED } from "@/lib/dev-auth";

interface AppLayoutProps {
  readonly children: ReactNode;
}

/** Ścieżki dostępne także bez rodziny (wylogowanie, panel admina). */
const HOUSEHOLD_FREE_PATHS = ["/settings", "/admin"] as const;

/**
 * Główny layout strefy zalogowanej aplikacji Spanko.
 *
 * @description
 * Zapewnia mobilny kontener dopasowany do obsługi jednym kciukiem w nocy, głębokie tło #0B0F17
 * chroniące melatoninę oraz przestrzeń na dolny Floating Action Bar. Bramka sesji: brak logowania →
 * /login, brak zgód → /onboarding/consent, brak rodziny → /onboarding. W development bez sesji
 * pulpit pokazuje dane demonstracyjne.
 *
 * @param {AppLayoutProps} props - Właściwości layoutu zawierające komponenty potomne
 * @returns {ReactNode} Wyrenderowany kontener aplikacji
 */
export default function AppLayout({ children }: AppLayoutProps): ReactNode {
  const pathname = usePathname();
  const { t } = useI18n();
  const householdFree = HOUSEHOLD_FREE_PATHS.some((path) => pathname.startsWith(path));
  const guard = useOnboardingGuard({
    allowedSteps: householdFree ? ["consent", "choose", "ready"] : ["ready"],
    allowSignedOut: IS_DEV_LOGIN_ENABLED || householdFree,
  });

  return (
    <div className="min-h-dvh bg-[#0B0F17] text-ink flex flex-col items-center">
      <div className="w-full max-w-md min-h-dvh flex flex-col relative px-4 pt-4 pb-32">
        {guard.status === "checking" ? (
          <p className="pt-20 text-center text-sm text-slate-400">{t("common.loading")}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
