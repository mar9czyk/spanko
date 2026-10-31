"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type OnboardingStep, resolveOnboardingStep } from "@/lib/onboarding";
import { getCurrentAuthenticatedUser, pb } from "@/lib/pocketbase";
import type { UserRecord } from "@/lib/types/database";

export type GuardState =
  | { readonly status: "checking" }
  | { readonly status: "ready"; readonly user: UserRecord | null };

const STEP_PATH: Readonly<Record<OnboardingStep, string | null>> = {
  login: "/login",
  consent: "/onboarding/consent",
  choose: "/onboarding",
  ready: null,
};

/**
 * Pilnuje wejścia do strefy aplikacji/onboardingu: odświeża sesję i przekierowuje na właściwy etap.
 *
 * @param {object} options - `allowedSteps`: etapy, na których ta strona jest właściwa;
 *   `allowSignedOut`: nie przekierowuj na login (tryb demo w development)
 * @returns {GuardState} Stan sprawdzenia i rekord użytkownika
 */
export function useOnboardingGuard(options: {
  readonly allowedSteps: readonly OnboardingStep[];
  readonly allowSignedOut?: boolean;
}): GuardState {
  const router = useRouter();
  const [state, setState] = useState<GuardState>({ status: "checking" });
  const { allowedSteps, allowSignedOut } = options;
  const allowedKey = allowedSteps.join(",");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (pb.authStore.isValid) {
        try {
          await pb.collection("users").authRefresh();
        } catch (error) {
          const status = (error as { status?: number }).status;
          // 0 = brak sieci: zostajemy przy zapisanej sesji; inaczej konto jest nieważne/zablokowane.
          if (status !== 0 && status !== undefined) pb.authStore.clear();
        }
      }
      if (cancelled) return;
      const user = pb.authStore.isValid ? getCurrentAuthenticatedUser() : null;
      if (!user && allowSignedOut) {
        setState({ status: "ready", user: null });
        return;
      }
      const step = resolveOnboardingStep(user);
      if (!allowedKey.split(",").includes(step)) {
        router.replace(STEP_PATH[step] ?? "/dashboard");
        return;
      }
      setState({ status: "ready", user });
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [router, allowedKey, allowSignedOut]);

  return state;
}
