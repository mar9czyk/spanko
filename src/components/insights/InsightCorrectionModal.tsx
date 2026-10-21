import { Check, Clock, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { ChildInsightRecord } from "@/lib/types/database";
import type { InsightCorrectionFormValues } from "./types";

interface InsightCorrectionModalProps {
  readonly insight: ChildInsightRecord | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSubmitCorrection: (values: InsightCorrectionFormValues) => void;
}

const WAKE_WINDOW_OFFSET_OPTIONS = [-30, -15, 0, 15, 30] as const;

/**
 * Pigułka wyboru korekty okna czuwania w minutach.
 *
 * @param {object} props - Wartość, zaznaczenie i callback
 * @returns {ReactNode} Przycisk opcji
 */
function OffsetOptionButton({
  offset,
  isSelected,
  onSelect,
}: {
  offset: number;
  isSelected: boolean;
  onSelect: (val: number) => void;
}) {
  const { t } = useI18n();
  const label = offset > 0 ? `+${offset} min` : `${offset} min`;

  return (
    <button
      type="button"
      onClick={() => onSelect(offset)}
      className={`py-1 px-2.5 rounded-lg text-xs tabular-nums font-medium transition-all ${
        isSelected
          ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
          : "bg-[#1E2738] text-slate-300 hover:bg-[#28354c]"
      }`}
    >
      {offset === 0 ? t("correction.noChange") : label}
    </button>
  );
}

/**
 * Modal Human-in-the-Loop umożliwiający korektę wniosku i wykluczenie anomalii z kalibracji.
 *
 * @param {InsightCorrectionModalProps} props - Stan widoczności i handlery
 * @returns {ReactNode | null} Okno dialogowe korekty
 */
export function InsightCorrectionModal({
  insight,
  isOpen,
  onClose,
  onSubmitCorrection,
}: InsightCorrectionModalProps): ReactNode {
  const { t } = useI18n();
  const [isAnomaly, setIsAnomaly] = useState(false);
  const [offsetMin, setOffsetMin] = useState<number>(0);
  const [note, setNote] = useState("");

  if (!isOpen || !insight) return null;

  const handleSubmit = () => {
    onSubmitCorrection({
      feedback: isAnomaly ? "rejected" : "adjusted",
      parentCorrectionNote: note.trim(),
      isAnomalyException: isAnomaly,
      wakeWindowOffsetMinutes: offsetMin,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs p-3">
      <div className="w-full max-w-md bg-[#151B28] border border-[#263348] rounded-3xl p-4 flex flex-col gap-3.5 shadow-2xl animate-in fade-in slide-in-from-bottom-6 duration-200">
        <div className="flex items-center justify-between pb-1 border-b border-[#263348]/60">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm">
            <Clock className="w-4 h-4" />
            <span>{t("correction.title")}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-ink rounded-lg hover:bg-[#1E2738]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-snug">{insight.title}</p>

        <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#1E2738]/60 border border-[#263348] cursor-pointer">
          <input
            type="checkbox"
            checked={isAnomaly}
            onChange={(e) => setIsAnomaly(e.target.checked)}
            className="w-4 h-4 rounded text-amber-500 bg-[#0B0F17] border-[#263348] mt-0.5"
          />
          <div className="flex-1">
            <span className="text-xs font-semibold text-ink block">
              {t("correction.exception")}
            </span>
            <span className="text-xs text-slate-400 block mt-0.5">
              {t("correction.exceptionHelp")}
            </span>
          </div>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-300">{t("correction.adjustWindow")}</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {WAKE_WINDOW_OFFSET_OPTIONS.map((opt) => (
              <OffsetOptionButton
                key={opt}
                offset={opt}
                isSelected={offsetMin === opt}
                onSelect={setOffsetMin}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-300">{t("correction.note")}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("correction.placeholder")}
            className="w-full h-16 p-2 rounded-xl bg-[#0B0F17] border border-[#263348] text-xs text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-amber-500/50 resize-none"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-[#1E2738] text-slate-300 text-xs font-medium hover:bg-[#28354c]"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{t("correction.save")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
