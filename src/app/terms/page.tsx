import type { ReactNode } from "react";
import { LegalPage } from "@/components/LegalPage";

/**
 * Publiczna strona: terms.
 *
 * @returns {ReactNode} Dokument
 */
export default function TermsPage(): ReactNode {
  return <LegalPage kind="terms" />;
}
