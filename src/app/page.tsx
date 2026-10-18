import { redirect } from "next/navigation";

/**
 * Przekierowuje użytkownika bezpośrednio do głównego pulpitu aplikacji Spanko.
 */
export default function Home() {
  redirect("/dashboard");
}
