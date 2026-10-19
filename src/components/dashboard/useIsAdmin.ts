"use client";

import { useEffect, useState } from "react";
import { pb } from "@/lib/pocketbase";

/**
 * Czy zalogowany użytkownik jest administratorem (`is_admin` z sesji PocketBase).
 *
 * @description
 * Służy wyłącznie do pokazania linku do panelu — to wygoda UI. Faktyczna ochrona jest po stronie
 * serwera (`requireAdmin`) i reguł kolekcji. Wartość ustawiana po zamontowaniu, bo sesja żyje
 * w localStorage (render serwerowy jej nie widzi), i odświeżana przy zmianie logowania.
 *
 * @returns {boolean} True, gdy sesja należy do admina
 */
export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const update = () => setIsAdmin(pb.authStore.isValid && pb.authStore.record?.is_admin === true);
    update();
    return pb.authStore.onChange(update);
  }, []);

  return isAdmin;
}
