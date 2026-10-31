import type { ReactNode } from "react";
import { LegalPage } from "@/components/LegalPage";

/**
 * Publiczna strona: privacy.
 *
 * @returns {ReactNode} Dokument
 */
export default function PrivacyPage(): ReactNode {
  return <LegalPage kind="privacy" />;
}
