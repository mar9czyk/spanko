"use client";

import { Timer, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { REM_COUNTDOWN_SECONDS } from "./constants";

/**
 * Przycisk i odliczanie 60 sekund wstrzymania dla noworodków w aktywnej fazie REM.
 *
 * @description
 * Chroni przed wybudzeniem niemowlęcia będącego w fizjologicznej fazie aktywnego snu,
 * w której dziecko wykonuje grymasy i wydaje dźwięki bez rzeczywistego wybudzenia.
 *
 * @returns {ReactNode} Komponent odliczania REM
 */
export function ActiveSleepRemTimer(): ReactNode {
  const [isActive, setIsActive] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(REM_COUNTDOWN_SECONDS);

  useEffect(() => {
    if (!isActive) return;

    if (secondsRemaining <= 0) {
      setIsActive(false);
      return;
    }

    const timerId = setTimeout(() => {
      setSecondsRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timerId);
  }, [isActive, secondsRemaining]);

  const handleStart = () => {
    setSecondsRemaining(REM_COUNTDOWN_SECONDS);
    setIsActive(true);
  };

  const handleCancel = () => {
    setIsActive(false);
    setSecondsRemaining(REM_COUNTDOWN_SECONDS);
  };

  if (!isActive) {
    return (
      <button
        type="button"
        onClick={handleStart}
        className="w-full py-2 px-3 rounded-xl bg-violet-950/30 hover:bg-violet-900/40 border border-violet-500/30 text-violet-300 text-xs font-medium flex items-center justify-center gap-2 transition-all shadow-sm"
      >
        <Timer className="w-4 h-4 text-violet-400" />
        <span>⏱️ Odczekaj 60s (Active Sleep REM)</span>
      </button>
    );
  }

  return (
    <div className="w-full p-2.5 rounded-xl bg-[#151B28] border border-violet-500/40 flex flex-col gap-1.5 animate-fadeIn">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-violet-300 flex items-center gap-1.5">
          <Timer className="w-3.5 h-3.5 animate-spin" />
          Faza REM: Odczekaj {secondsRemaining}s
        </span>
        <button
          type="button"
          onClick={handleCancel}
          className="text-slate-400 hover:text-slate-200 p-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-[10px] text-slate-300 leading-tight">
        Noworodek może wiercić się i kwilić przez sen. Odczekaj chwilę, nim weźmiesz go na ręce.
      </p>
    </div>
  );
}
