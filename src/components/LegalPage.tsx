"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { LEGAL_CONTENT, type LegalKind } from "@/lib/legal-content";

/**
 * Publiczna strona z regulaminem lub polityką prywatności w języku użytkownika.
 *
 * @param {object} props - Rodzaj dokumentu
 * @returns {ReactNode} Strona dokumentu
 */
export function LegalPage({ kind }: { readonly kind: LegalKind }): ReactNode {
  const { locale, t } = useI18n();
  const doc = LEGAL_CONTENT[kind][locale];
  return (
    <div className="min-h-screen bg-[#0B0F17] text-ink flex justify-center">
      <main className="flex w-full max-w-md flex-col gap-5 px-6 py-12">
        <Link href="/login" className="text-xs text-slate-400 hover:text-amber-400">
          ← {t("common.back")}
        </Link>
        <h1 className="text-2xl font-semibold text-amber-200">{doc.title}</h1>
        <p className="text-xs text-slate-500">{doc.draftNote}</p>
        {doc.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-ink">{section.heading}</h2>
            <p className="text-sm text-slate-300">{section.body}</p>
          </section>
        ))}
      </main>
    </div>
  );
}
