"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { ChildRecord } from "@/lib/types/database";

interface ChildSwitcherProps {
  readonly childrenList: readonly ChildRecord[];
  readonly activeChildId: string;
  readonly onSelectChild: (childId: string) => void;
}

/**
 * Przełącznik dziecka dla gospodarstw z więcej niż jednym dzieckiem (ukryty przy jednym dziecku).
 *
 * @param {ChildSwitcherProps} props - Dzieci gospodarstwa, aktywne dziecko i obsługa wyboru
 * @returns {ReactNode} Rząd przycisków z imionami dzieci
 */
export function ChildSwitcher({
  childrenList,
  activeChildId,
  onSelectChild,
}: ChildSwitcherProps): ReactNode {
  const { t } = useI18n();
  if (childrenList.length < 2) return null;
  return (
    <fieldset
      aria-label={t("header.childSwitcher")}
      className="m-0 flex min-w-0 gap-1.5 overflow-x-auto border-0 p-0"
    >
      {childrenList.map((item) => {
        const isActive = item.id === activeChildId;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelectChild(item.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
              isActive
                ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                : "border-[#263348] bg-[#151B28] text-slate-400 hover:text-slate-200"
            }`}
          >
            <span
              aria-hidden="true"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1E2738] text-[10px]"
            >
              {item.name.charAt(0).toUpperCase()}
            </span>
            {item.name}
          </button>
        );
      })}
    </fieldset>
  );
}
