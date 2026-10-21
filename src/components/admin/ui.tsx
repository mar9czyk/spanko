import type { ButtonHTMLAttributes, ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-ink placeholder:text-slate-500 focus:border-amber-500/60 focus:outline-none";

/**
 * Etykieta z polem formularza.
 *
 * @param {object} props - Etykieta i zawartość
 * @returns {ReactNode} Pole
 */
export function Field({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5 border-0 p-0">
      <legend className="mb-1.5 text-xs font-medium text-slate-400">{label}</legend>
      {children}
    </fieldset>
  );
}

/**
 * Główny przycisk akcji w panelu admina (amber, duży obszar dotyku).
 *
 * @param {ButtonHTMLAttributes<HTMLButtonElement>} props - Standardowe właściwości przycisku
 * @returns {ReactNode} Przycisk
 */
export function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>): ReactNode {
  return (
    <button
      type="button"
      {...props}
      className="min-h-11 rounded-xl bg-amber-500/90 px-4 text-sm font-semibold text-[#0B0F17] disabled:opacity-50"
    />
  );
}

/**
 * Komunikat ładowania lub błędu.
 *
 * @param {object} props - Błąd i/lub tekst ładowania
 * @returns {ReactNode} Komunikat albo null
 */
export function StatusMessage({
  error,
  loading,
}: {
  error?: string | null;
  loading?: string;
}): ReactNode {
  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
        {error}
      </p>
    );
  }
  return loading ? <p className="text-sm text-slate-400">{loading}</p> : null;
}
