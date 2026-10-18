import { Compass } from "lucide-react";
import type { ReactNode } from "react";

interface AntiOrthosomniaToggleProps {
  readonly isActive: boolean;
  readonly onToggle: () => void;
}

/**
 * Przełącznik trybu Anti-Orthosomnia Mode chroniący rodzica przed lękiem zegarowym.
 *
 * @description
 * Zamienia precyzyjny co do minuty zegar SweetSpot na miękki przedział kompasowy
 * (np. "Wypatruj ziewania między 13:00 a 13:30").
 *
 * @param {AntiOrthosomniaToggleProps} props - Stan aktywności i funkcja przełączająca
 * @returns {ReactNode} Element przycisku przełącznika
 */
export function AntiOrthosomniaToggle({
  isActive,
  onToggle,
}: AntiOrthosomniaToggleProps): ReactNode {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all min-h-[36px] ${
        isActive
          ? "bg-violet-950/40 text-violet-300 border-violet-500/50 shadow-sm shadow-violet-500/20"
          : "bg-[#151B28] text-slate-400 border-[#263348] hover:text-slate-200"
      }`}
      title="Przełącz między precyzyjnym zegarem a miękkim kompasem snu (Anti-Orthosomnia)"
    >
      <Compass
        className={`w-4 h-4 transition-transform ${isActive ? "rotate-45 text-violet-400" : ""}`}
      />
      <span>{isActive ? "Miękki kompas" : "Zegar"}</span>
    </button>
  );
}
