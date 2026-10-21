"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Wyłącza animacje Framer Motion, gdy system prosi o ograniczenie ruchu (prefers-reduced-motion).
 *
 * @param {object} props - Elementy potomne
 * @returns {ReactNode} Konfiguracja animacji
 */
export function ReducedMotionProvider({ children }: { readonly children: ReactNode }): ReactNode {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
