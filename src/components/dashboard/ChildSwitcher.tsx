"use client";

import { Camera } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { childPhotoUrl } from "@/lib/child-photo";
import { pb } from "@/lib/pocketbase";
import type { ChildRecord } from "@/lib/types/database";

interface ChildSwitcherProps {
  readonly childrenList: readonly ChildRecord[];
  readonly activeChild: ChildRecord;
  readonly ageDisplay: string;
  readonly onSelectChild: (childId: string) => void;
  /** Otwiera panel zdjęcia aktywnego dziecka; brak = zdjęcia nie da się zmienić (dane demo) */
  readonly onOpenPhoto?: () => void;
}

/**
 * Pobiera token plików PocketBase, gdy któreś dziecko ma zdjęcie (pole chronione); odświeża go po zmianie zdjęć.
 *
 * @param {readonly ChildRecord[]} children - Dzieci widoczne w przełączniku
 * @returns {string | null} Token plików lub null przed pobraniem
 */
export function useChildFileToken(children: readonly ChildRecord[]): string | null {
  const [fileToken, setFileToken] = useState<string | null>(null);
  const photoKey = children.map((item) => item.photo ?? "").join("|");
  useEffect(() => {
    if (!photoKey.replaceAll("|", "")) return;
    let isCancelled = false;
    pb.files
      .getToken()
      .then((token) => {
        if (!isCancelled) setFileToken(token);
      })
      .catch(() => {
        // Bez tokenu kółka pokazują inicjały.
      });
    return () => {
      isCancelled = true;
    };
  }, [photoKey]);
  return fileToken;
}

/**
 * Kółko dziecka: zdjęcie, jeśli zostało wgrane, w przeciwnym razie inicjał imienia.
 *
 * @param {object} props - Dziecko, URL zdjęcia, rozmiar i wyróżnienie aktywnego dziecka
 * @returns {ReactNode} Awatar dziecka
 */
export function ChildAvatar({
  child,
  photoUrl,
  size,
  isActive,
}: {
  child: ChildRecord;
  photoUrl: string | null;
  size: "md" | "lg";
  isActive: boolean;
}): ReactNode {
  const sizeClass = size === "lg" ? "h-20 w-20 text-2xl" : "h-10 w-10 text-sm";
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold transition-colors ${sizeClass} ${
        isActive
          ? "border-2 border-amber-400/80 bg-gradient-to-br from-amber-500/20 to-violet-500/20 text-amber-300"
          : "border border-[#263348] bg-[#1E2738] text-slate-400"
      }`}
    >
      {photoUrl ? (
        // biome-ignore lint/performance/noImgElement: miniatura z PocketBase z tokenem, next/image nie ma tu czego optymalizować
        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        child.name.charAt(0).toUpperCase()
      )}
    </span>
  );
}

/**
 * Kółka dzieci w nagłówku: dotknięcie innego dziecka przełącza pulpit, dotknięcie aktywnego otwiera jego zdjęcie.
 *
 * @param {ChildSwitcherProps} props - Dzieci gospodarstwa, aktywne dziecko, wiek i obsługa wyboru
 * @returns {ReactNode} Tożsamość aktywnego dziecka (jedno dziecko) lub rząd kółek z imionami
 */
export function ChildSwitcher({
  childrenList,
  activeChild,
  ageDisplay,
  onSelectChild,
  onOpenPhoto,
}: ChildSwitcherProps): ReactNode {
  const { t } = useI18n();
  const fileToken = useChildFileToken(childrenList);
  const urlFor = (item: ChildRecord) => (fileToken ? childPhotoUrl(item, fileToken) : null);

  if (childrenList.length < 2) {
    return (
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenPhoto}
          disabled={!onOpenPhoto}
          aria-label={t("childPhoto.open", { name: activeChild.name })}
          className="relative rounded-full disabled:cursor-default"
        >
          <ChildAvatar child={activeChild} photoUrl={urlFor(activeChild)} size="md" isActive />
          {onOpenPhoto && !activeChild.photo && (
            <Camera
              aria-hidden="true"
              className="absolute -right-0.5 -bottom-0.5 h-4 w-4 rounded-full bg-[#151B28] p-0.5 text-amber-300"
            />
          )}
        </button>
        <div>
          <h1 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5 leading-tight">
            {activeChild.name}
            <span className="text-[11px] font-normal text-slate-400">({ageDisplay})</span>
          </h1>
          <p className="text-[10px] text-slate-500">{t("header.mode")}</p>
        </div>
      </div>
    );
  }

  return (
    <fieldset
      aria-label={t("header.childSwitcher")}
      className="m-0 flex min-w-0 items-start gap-2 overflow-x-auto border-0 p-0"
    >
      {childrenList.map((item) => {
        const isActive = item.id === activeChild.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={isActive}
            aria-label={isActive ? t("childPhoto.open", { name: item.name }) : item.name}
            onClick={() => (isActive ? onOpenPhoto?.() : onSelectChild(item.id))}
            className="flex w-14 shrink-0 flex-col items-center gap-0.5"
          >
            <ChildAvatar child={item} photoUrl={urlFor(item)} size="md" isActive={isActive} />
            <span
              className={`w-full truncate text-center text-[10px] leading-tight ${
                isActive ? "font-semibold text-amber-300" : "text-slate-400"
              }`}
            >
              {item.name}
            </span>
            {isActive && (
              <span className="w-full truncate text-center text-[9px] leading-tight text-slate-500">
                {ageDisplay}
              </span>
            )}
          </button>
        );
      })}
    </fieldset>
  );
}
