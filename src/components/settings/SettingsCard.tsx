import type { ReactNode } from "react";

/**
 * Karta sekcji panelu użytkownika.
 *
 * @param {object} props - Tytuł, opcjonalny opis i zawartość
 * @returns {ReactNode} Sekcja w stylu kart dashboardu
 */
export function SettingsCard({
  title,
  hint,
  children,
}: {
  readonly title: string;
  readonly hint?: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <section className="rounded-2xl border border-[#263348] bg-[#151B28] p-4 flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        {hint && <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
