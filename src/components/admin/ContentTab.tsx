"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { DAY_TAG_PRESETS } from "@/components/dashboard/constants";
import { translateDynamic } from "@/i18n/translate";
import { adminRequest, jsonBody } from "./adminApi";
import { inputClass, PrimaryButton, StatusMessage } from "./ui";

interface ContentItem {
  readonly id: string;
  readonly key: string;
  readonly value_pl: string;
}

interface AnnouncementItem {
  readonly id: string;
  readonly message: string;
  readonly level: "info" | "warning";
  readonly starts_at?: string;
  readonly ends_at?: string;
  readonly active: boolean;
}

/**
 * Wiersz edycji jednego tekstu: pokazuje domyślną treść z kodu i pozwala ją nadpisać.
 *
 * @param {object} props - Klucz, domyślny tekst, aktualne nadpisanie i callback zapisu
 * @returns {ReactNode} Wiersz edycji
 */
function ContentRow({
  contentKey,
  defaultText,
  current,
  onSave,
}: {
  contentKey: string;
  defaultText: string;
  current: string;
  onSave: (key: string, value: string) => Promise<void>;
}): ReactNode {
  const [value, setValue] = useState(current);
  return (
    <div className="flex items-end gap-2">
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] text-slate-500">
        <span className="truncate">
          {contentKey} <span className="text-slate-600">(domyślnie: {defaultText || "—"})</span>
        </span>
        <input
          className={inputClass}
          maxLength={2000}
          placeholder={defaultText}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={value === current}
        className="min-h-11 rounded-xl border border-slate-700 px-3 text-xs text-slate-200 disabled:opacity-40"
        onClick={() => onSave(contentKey, value)}
      >
        Zapisz
      </button>
    </div>
  );
}

/**
 * Sekcja ogłoszeń: lista z przełączaniem aktywności, usuwaniem i formularz nowego ogłoszenia.
 *
 * @returns {ReactNode} Sekcja ogłoszeń
 */
function AnnouncementsSection(): ReactNode {
  const [items, setItems] = useState<readonly AnnouncementItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState<"info" | "warning">("info");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(
        (await adminRequest<{ items: readonly AnnouncementItem[] }>("/api/admin/announcements"))
          .items,
      );
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać ogłoszeń.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Operacja nie powiodła się.");
    }
  };

  const handleCreate = () =>
    run(async () => {
      await adminRequest("/api/admin/announcements", {
        method: "POST",
        ...jsonBody({
          message,
          level,
          active: true,
          starts_at: startsAt ? new Date(startsAt).toISOString() : null,
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        }),
      });
      setMessage("");
      setStartsAt("");
      setEndsAt("");
    });

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#151B28] p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Ogłoszenia (baner na dashboardzie)
      </h3>
      <StatusMessage error={error} loading={items || error ? undefined : "Ładowanie…"} />
      {items?.length === 0 && <p className="text-xs text-slate-500">Brak ogłoszeń.</p>}
      {items?.map((item) => (
        <div key={item.id} className="flex flex-col gap-1.5 rounded-lg border border-slate-800 p-2">
          <p className="text-xs text-slate-200">{item.message}</p>
          <p className="text-[11px] text-slate-500">
            {item.level} ·{" "}
            {item.starts_at ? new Date(item.starts_at).toLocaleString("pl-PL") : "od razu"} →{" "}
            {item.ends_at ? new Date(item.ends_at).toLocaleString("pl-PL") : "bez końca"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              aria-pressed={item.active}
              className={`min-h-11 rounded-xl border px-3 text-xs ${
                item.active
                  ? "border-emerald-500/40 text-emerald-300"
                  : "border-slate-700 text-slate-400"
              }`}
              onClick={() =>
                run(() =>
                  adminRequest(`/api/admin/announcements/${item.id}`, {
                    method: "PATCH",
                    ...jsonBody({ active: !item.active }),
                  }),
                )
              }
            >
              {item.active ? "Aktywne" : "Wyłączone"}
            </button>
            <button
              type="button"
              className="min-h-11 rounded-xl border border-red-500/40 px-3 text-xs text-red-300"
              onClick={() => {
                if (!window.confirm("Usunąć to ogłoszenie?")) return;
                run(() =>
                  adminRequest(`/api/admin/announcements/${item.id}`, { method: "DELETE" }),
                );
              }}
            >
              Usuń
            </button>
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
        <textarea
          className={`${inputClass} min-h-20`}
          aria-label="Treść ogłoszenia"
          placeholder="Np. W niedzielę 02:00–03:00 przerwa techniczna."
          maxLength={500}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <select
          className={inputClass}
          aria-label="Poziom ogłoszenia"
          value={level}
          onChange={(event) => setLevel(event.target.value as "info" | "warning")}
        >
          <option value="info">Informacja</option>
          <option value="warning">Ostrzeżenie</option>
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input
            className={inputClass}
            type="datetime-local"
            aria-label="Początek wyświetlania"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
          <input
            className={inputClass}
            type="datetime-local"
            aria-label="Koniec wyświetlania"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
          />
        </div>
        <PrimaryButton onClick={handleCreate} disabled={message.trim() === ""}>
          Dodaj ogłoszenie
        </PrimaryButton>
      </div>
    </section>
  );
}

/**
 * Zakładka "Treści": edycja etykiet tagów dnia i własnych tekstów oraz ogłoszenia dla użytkowników.
 *
 * @description
 * Nadpisania są polskie i działają bez wdrażania nowej wersji (pusta wartość przywraca tekst z kodu).
 *
 * @returns {ReactNode} Zawartość zakładki
 */
export function ContentTab(): ReactNode {
  const [items, setItems] = useState<readonly ContentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customKey, setCustomKey] = useState("");

  const load = useCallback(async () => {
    try {
      setItems((await adminRequest<{ items: readonly ContentItem[] }>("/api/admin/content")).items);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać treści.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (key: string, value: string) => {
    try {
      await adminRequest("/api/admin/content", {
        method: "PUT",
        ...jsonBody({ key, value_pl: value }),
      });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nie udało się zapisać.");
    }
  };

  const byKey = new Map((items ?? []).map((item) => [item.key, item.value_pl]));
  const presetKeys = new Set(DAY_TAG_PRESETS.map((tag) => `tag.${tag}`));
  const customItems = (items ?? []).filter((item) => !presetKeys.has(item.key));

  if (!items) {
    return <StatusMessage error={error} loading="Ładowanie…" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <StatusMessage error={error} />
      <section className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#151B28] p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Etykiety tagów dnia
        </h3>
        {DAY_TAG_PRESETS.map((tag) => {
          const key = `tag.${tag}`;
          return (
            <ContentRow
              key={`${key}:${byKey.get(key) ?? ""}`}
              contentKey={key}
              defaultText={translateDynamic("pl", key, tag)}
              current={byKey.get(key) ?? ""}
              onSave={handleSave}
            />
          );
        })}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#151B28] p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Własne teksty
        </h3>
        <p className="text-[11px] text-slate-500">
          Klucz musi odpowiadać kluczowi używanemu w aplikacji (np. tag.infekcja_ucha).
        </p>
        {customItems.map((item) => (
          <ContentRow
            key={`${item.key}:${item.value_pl}`}
            contentKey={item.key}
            defaultText={translateDynamic("pl", item.key, "")}
            current={item.value_pl}
            onSave={handleSave}
          />
        ))}
        <div className="flex gap-2">
          <input
            className={inputClass}
            aria-label="Nowy klucz tekstu"
            placeholder="np. tag.infekcja_ucha"
            maxLength={80}
            value={customKey}
            onChange={(event) => setCustomKey(event.target.value)}
          />
          <button
            type="button"
            disabled={customKey.trim() === "" || byKey.has(customKey.trim())}
            className="min-h-11 shrink-0 rounded-xl border border-slate-700 px-3 text-xs text-slate-200 disabled:opacity-40"
            onClick={() => {
              const key = customKey.trim();
              setItems([...(items ?? []), { id: `new:${key}`, key, value_pl: "" }]);
              setCustomKey("");
            }}
          >
            Dodaj klucz
          </button>
        </div>
      </section>

      <AnnouncementsSection />
    </div>
  );
}
