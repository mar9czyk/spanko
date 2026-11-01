"use client";

import { Check, Loader2 } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { loadActiveChild } from "@/lib/client-data";
import { pb } from "@/lib/pocketbase";
import type { ChildRecord } from "@/lib/types/database";

const MAX_NAME_LENGTH = 100;

type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Wycina część daty (RRRR-MM-DD) z zapisu ISO z PocketBase. */
function dateOnly(value: string | undefined): string {
  return value ? value.slice(0, 10) : "";
}

const FIELD_CLASS =
  "w-full rounded-xl border border-[#263348] bg-[#0B0F17] px-3 py-2 text-sm text-ink focus:border-amber-500/60 focus:outline-none";

/**
 * Formularz danych dziecka: imię, data urodzenia i termin porodu (dla wcześniaków).
 *
 * @param {object} props - Edytowane dziecko i callback po zapisie
 * @returns {ReactNode} Formularz
 */
function ChildForm({
  child,
  onSaved,
}: {
  readonly child: ChildRecord;
  readonly onSaved: (child: ChildRecord) => void;
}): ReactNode {
  const { t } = useI18n();
  const [name, setName] = useState(child.name);
  const [birthDate, setBirthDate] = useState(dateOnly(child.birth_date));
  const [premature, setPremature] = useState(Boolean(child.due_date));
  const [dueDate, setDueDate] = useState(dateOnly(child.due_date));
  const [status, setStatus] = useState<SaveStatus>("idle");

  const today = new Date().toISOString().slice(0, 10);
  const trimmed = name.trim();
  const nextDue = premature ? dueDate : "";
  const isDirty =
    trimmed !== child.name ||
    birthDate !== dateOnly(child.birth_date) ||
    nextDue !== dateOnly(child.due_date);
  const isValid = trimmed !== "" && birthDate !== "" && (!premature || dueDate !== "");

  const touch = () => setStatus("idle");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isDirty || !isValid) return;
    setStatus("saving");
    try {
      const updated = await pb.collection("children").update<ChildRecord>(child.id, {
        name: trimmed,
        birth_date: birthDate,
        due_date: nextDue,
      });
      onSaved(updated);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-400">{t("onb.family.childName")}</span>
        <input
          value={name}
          maxLength={MAX_NAME_LENGTH}
          onChange={(event) => {
            setName(event.target.value);
            touch();
          }}
          className={FIELD_CLASS}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-400">{t("onb.family.birthDate")}</span>
        <input
          type="date"
          value={birthDate}
          max={today}
          onChange={(event) => {
            setBirthDate(event.target.value);
            touch();
          }}
          className={FIELD_CLASS}
        />
      </label>
      <label className="flex items-center gap-3 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={premature}
          onChange={(event) => {
            setPremature(event.target.checked);
            touch();
          }}
          className="h-5 w-5 accent-violet-500"
        />
        {t("onb.family.premature")}
      </label>
      {premature && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">{t("onb.family.dueDate")}</span>
          <input
            type="date"
            value={dueDate}
            min={birthDate || undefined}
            onChange={(event) => {
              setDueDate(event.target.value);
              touch();
            }}
            className={FIELD_CLASS}
          />
        </label>
      )}
      <div className="flex items-center justify-end gap-3">
        {status === "saved" && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <Check className="w-3.5 h-3.5" />
            {t("settings.saved")}
          </span>
        )}
        {status === "error" && (
          <span role="alert" className="text-xs text-red-300">
            {t("settings.saveFailed")}
          </span>
        )}
        <button
          type="submit"
          disabled={!isDirty || !isValid || status === "saving"}
          className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-opacity disabled:opacity-40"
        >
          {status === "saving" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {status === "saving" ? t("settings.saving") : t("settings.save")}
        </button>
      </div>
    </form>
  );
}

/**
 * Zawartość karty „Dane dziecka” w ustawieniach: edycja aktywnego dziecka.
 *
 * @returns {ReactNode} Formularz lub komunikat o braku dziecka
 */
export function ChildProfileSection(): ReactNode {
  const { t } = useI18n();
  const [child, setChild] = useState<ChildRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadActiveChild()
      .then(setChild)
      .catch(() => setChild(null))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return <p className="text-sm text-slate-400">{t("env.loading")}</p>;
  if (!child) return <p className="text-sm text-slate-400">{t("env.noChild")}</p>;
  return <ChildForm key={`${child.id}:${child.updated}`} child={child} onSaved={setChild} />;
}
