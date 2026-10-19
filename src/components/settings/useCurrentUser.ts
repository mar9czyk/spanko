"use client";

import { useEffect, useState } from "react";
import { getCurrentAuthenticatedUser, pb } from "@/lib/pocketbase";
import type { UserRecord } from "@/lib/types/database";

export type CurrentUserState =
  | { readonly status: "loading" }
  | { readonly status: "signedOut" }
  | { readonly status: "signedIn"; readonly user: UserRecord };

/**
 * Zalogowany użytkownik z sesji PocketBase, odświeżany przy każdej zmianie sesji.
 *
 * @description
 * Wartość ustawiana po zamontowaniu, bo sesja żyje w localStorage (render serwerowy jej nie widzi).
 *
 * @returns {CurrentUserState} Stan sesji i rekord użytkownika
 */
export function useCurrentUser(): CurrentUserState {
  const [state, setState] = useState<CurrentUserState>({ status: "loading" });

  useEffect(() => {
    const update = () => {
      const user = pb.authStore.isValid ? getCurrentAuthenticatedUser() : null;
      setState(user ? { status: "signedIn", user } : { status: "signedOut" });
    };
    update();
    return pb.authStore.onChange(update);
  }, []);

  return state;
}
