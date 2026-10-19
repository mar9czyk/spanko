"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, Trash2, X } from "lucide-react";
import { type ChangeEvent, type ReactNode, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { childPhotoUrl } from "@/lib/child-photo";
import type { ChildRecord } from "@/lib/types/database";
import { ChildAvatar, useChildFileToken } from "./ChildSwitcher";

interface ChildPhotoSheetProps {
  readonly child: ChildRecord;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  /** Zapisuje nowe zdjęcie (File) lub usuwa obecne (null) */
  readonly onChangePhoto: (file: File | null) => Promise<boolean>;
}

/**
 * Dolny panel dodawania, zmiany i usuwania zdjęcia aktywnego dziecka.
 *
 * @param {ChildPhotoSheetProps} props - Dziecko, stan panelu i zapis zdjęcia
 * @returns {ReactNode} Panel zdjęcia dziecka
 */
export function ChildPhotoSheet({
  child,
  isOpen,
  onClose,
  onChangePhoto,
}: ChildPhotoSheetProps): ReactNode {
  const { t } = useI18n();
  const fileToken = useChildFileToken([child]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);

  const save = async (file: File | null) => {
    setIsSaving(true);
    setHasError(false);
    const isSaved = await onChangePhoto(file);
    setIsSaving(false);
    if (isSaved) onClose();
    else setHasError(true);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) save(file);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="relative w-full max-w-md bg-[#151B28] border-t border-[#263348] rounded-t-3xl p-4 flex flex-col items-center gap-4 shadow-2xl z-10"
          >
            <div className="w-12 h-1 bg-[#263348] rounded-full" />
            <div className="flex w-full items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">{t("childPhoto.title")}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("common.back")}
                className="p-1 rounded-full text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ChildAvatar
              child={child}
              photoUrl={fileToken ? childPhotoUrl(child, fileToken) : null}
              size="lg"
              isActive
            />
            <p className="text-sm font-semibold text-slate-200">{child.name}</p>
            <label
              className={`flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-semibold text-slate-950 ${
                isSaving ? "pointer-events-none opacity-60" : "cursor-pointer"
              }`}
            >
              <Camera className="h-4 w-4" />
              {isSaving
                ? t("childPhoto.saving")
                : child.photo
                  ? t("childPhoto.change")
                  : t("childPhoto.add")}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={isSaving}
                onChange={handleFileChange}
              />
            </label>
            {child.photo && (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => save(null)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#263348] bg-[#1E2738] py-3 text-sm font-medium text-slate-300 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {t("childPhoto.remove")}
              </button>
            )}
            {hasError && (
              <p role="alert" className="text-xs text-red-300">
                {t("childPhoto.saveError")}
              </p>
            )}
            <p className="text-[11px] text-slate-500">{t("childPhoto.hint")}</p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
