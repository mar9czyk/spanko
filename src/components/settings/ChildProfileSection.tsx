"use client";

import { Check, Loader2 } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { pickActiveChild, readStoredActiveChildId, storeActiveChildId } from "@/lib/active-child";
import { loadChildren } from "@/lib/client-data";
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
  householdId,
  timezone,
  onSaved,
}: {
  readonly child: ChildRecord | null;
  readonly householdId?: string;
  readonly timezone?: string;
  readonly onSaved: (child: ChildRecord) => void;
}): ReactNode {
  const { t } = useI18n();
  const [name, setName] = useState(child?.name ?? "");
  const [birthDate, setBirthDate] = useState(dateOnly(child?.birth_date));
  const [premature, setPremature] = useState(Boolean(child?.due_date));
  const [dueDate, setDueDate] = useState(dateOnly(child?.due_date));
  const [status, setStatus] = useState<SaveStatus>("idle");

  const today = new Date().toISOString().slice(0, 10);
  const trimmed = name.trim();
  const nextDue = premature ? dueDate : "";
  const isDirty =
    !child ||
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
      const data = { name: trimmed, birth_date: birthDate, due_date: nextDue };
      const saved = child
        ? await pb.collection("children").update<ChildRecord>(child.id, data)
        : await pb.collection("children").create<ChildRecord>({
            ...data,
            household_id: householdId,
            active_day_mode: "home",
            anti_orthosomnia_mode: false,
            ...(timezone ? { timezone } : {}),
          });
      onSaved(saved);
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
          {status === "saving"
            ? t("settings.saving")
            : child
              ? t("settings.save")
              : t("settings.addChildSubmit")}
        </button>
      </div>
    </form>
  );
}

/**
 * Zawartość karty „Dane dziecka”: wybór dziecka, edycja jego danych oraz dodanie kolejnego dziecka do rodziny.
 *
 * @returns {ReactNode} Karta z formularzami lub komunikat o braku dziecka
 */
export function ChildProfileSection(): ReactNode {
  const { t } = useI18n();
  const [children, setChildren] = useState<ChildRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadChildren()
      .then((list) => {
        setChildren(list);
        setSelectedId(pickActiveChild(list, readStoredActiveChildId())?.id ?? null);
      })
      .catch(() => setChildren([]))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return <p className="text-sm text-slate-400">{t("env.loading")}</p>;
  const selected = children.find((item) => item.id === selectedId) ?? children[0] ?? null;
  if (!selected) return <p className="text-sm text-slate-400">{t("env.noChild")}</p>;

  const select = (id: string) => {
    setSelectedId(id);
    storeActiveChildId(id);
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {children.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {children.map((item) => {
            const isSelected = !adding && item.id === selected.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => select(item.id)}
                className={`min-h-10 rounded-lg border px-3 text-sm ${isSelected ? "border-amber-400/60 bg-amber-950/40 text-amber-200" : "border-[#263348] bg-[#1E2738] text-slate-300"}`}
              >
                {item.name}
              </button>
            );
          })}
        </div>
      )}
      {adding ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-ink">{t("settings.addChild")}</p>
          <ChildForm
            child={null}
            householdId={selected.household_id}
            timezone={selected.timezone}
            onSaved={(created) => {
              setChildren((list) => [...list, created]);
              select(created.id);
            }}
          />
        </div>
      ) : (
        <>
          <ChildForm
            key={`${selected.id}:${selected.updated}`}
            child={selected}
            onSaved={(updated) =>
              setChildren((list) => list.map((item) => (item.id === updated.id ? updated : item)))
            }
          />
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="min-h-11 rounded-xl border border-dashed border-violet-400/40 px-4 text-sm font-semibold text-violet-200"
          >
            {t("settings.addChild")}
          </button>
        </>
      )}
    </div>
  );
}
