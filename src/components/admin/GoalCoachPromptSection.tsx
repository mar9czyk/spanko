"use client";

import { type ReactNode, useEffect, useState } from "react";
import { Field, inputClass, PrimaryButton } from "./ui";

interface GoalCoachPromptSectionProps {
  readonly savedPrompt: string;
  readonly defaultPrompt: string;
  readonly isSaving: boolean;
  readonly onSave: (prompt: string) => Promise<boolean>;
}

/**
 * Edycja promptu systemowego coacha celów (`system_prompt_goal_coach`); pusty = domyślny.
 * Bez wersjonowania — zmiany trafiają do dziennika audytu jako `settings.update`.
 *
 * @param {GoalCoachPromptSectionProps} props - Zapisany i domyślny prompt oraz zapis
 * @returns {ReactNode} Sekcja formularza
 */
export function GoalCoachPromptSection({
  savedPrompt,
  defaultPrompt,
  isSaving,
  onSave,
}: GoalCoachPromptSectionProps): ReactNode {
  const [value, setValue] = useState(savedPrompt);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValue(savedPrompt);
  }, [savedPrompt]);

  const handleSave = async () => {
    setSaved(false);
    setSaved(await onSave(value.trim()));
  };

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-[#151B28] p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Prompt coacha celów
      </h3>
      <Field label="Prompt systemowy coacha (pusty = domyślny)">
        <textarea
          className={`${inputClass} min-h-40 font-mono text-xs`}
          value={value}
          placeholder={defaultPrompt}
          onChange={(event) => setValue(event.target.value)}
        />
      </Field>
      <div className="flex gap-2">
        <PrimaryButton onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Zapisywanie…" : "Zapisz prompt coacha"}
        </PrimaryButton>
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-xl border border-slate-700 px-4 text-xs text-slate-300"
          onClick={() => setValue("")}
        >
          Przywróć domyślny
        </button>
      </div>
      {saved && <p className="text-xs text-emerald-400">Zapisano. Pusty prompt = domyślny.</p>}
    </section>
  );
}
