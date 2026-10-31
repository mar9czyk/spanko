import type { ReactNode } from "react";

/**
 * Układ ekranów onboardingu (zgody, wybór rodziny). Bramkę sesji realizuje każdy ekran osobno.
 *
 * @param {{ children: ReactNode }} props - Ekran onboardingu
 * @returns {ReactNode} Zawartość
 */
export default function OnboardingLayout({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  return children;
}
