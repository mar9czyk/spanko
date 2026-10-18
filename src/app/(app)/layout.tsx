import type { ReactNode } from "react";

interface AppLayoutProps {
  readonly children: ReactNode;
}

/**
 * Główny layout strefy zalogowanej aplikacji Spanko.
 *
 * @description
 * Zapewnia mobilny kontener dopasowany do obsługi jednym kciukiem w nocy,
 * głębokie tło #0B0F17 chroniące melatoninę oraz przestrzeń na dolny Floating Action Bar.
 *
 * @param {AppLayoutProps} props - Właściwości layoutu zawierające komponenty potomne
 * @returns {ReactNode} Wyrenderowany kontener aplikacji
 */
export default function AppLayout({ children }: AppLayoutProps): ReactNode {
  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col items-center">
      <div className="w-full max-w-md min-h-screen flex flex-col relative px-4 pt-4 pb-32">
        {children}
      </div>
    </div>
  );
}
