"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { AiQualityReport, QualityRow } from "@/lib/admin/quality";
import type { AiCallRecord, AiCallStatus } from "@/lib/types/database";
import { adminRequest, jsonBody } from "./adminApi";
import { inputClass, PrimaryButton, StatusMessage } from "./ui";

interface InsightReaction {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly parent_feedback: string | null;
  readonly parent_correction_note: string | null;
}

type InspectedCall = AiCallRecord & { readonly insight: InsightReaction | null };

interface CallsPage {
  readonly items: readonly InspectedCall[];
  readonly page: number;
  readonly totalPages: number;
  readonly totalItems: number;
}

interface QualityResponse {
  readonly analyzed: number;
  readonly report: AiQualityReport;
  readonly corrections: readonly {
    readonly id: string;
    readonly category: string;
    readonly title: string;
    readonly note: string;
    readonly feedback: string | null;
    readonly updated: string;
  }[];
}

interface ReplayResponse {
  readonly original: { readonly model: string | null; readonly response: unknown };
  readonly replay: {
    readonly status: string;
    readonly model: string;
    readonly insight: unknown;
    readonly errorMessage?: string;
    readonly latencyMs: number;
  };
}

interface Filters {
  status: "" | AiCallStatus;
  household: string;
  user: string;
  child: string;
  category: string;
  model: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = {
  status: "",
  household: "",
  user: "",
  child: "",
  category: "",
  model: "",
  from: "",
  to: "",
};

const CATEGORY_CODES = [
  "CAT1_ASSOCIATIONS_NIGHT_WAKINGS",
  "CAT2_BEDTIME_RESISTANCE_LATENCY",
  "CAT3_EARLY_WAKING_SPLIT_NIGHT",
  "CAT4_SHORT_NAPS_TRANSITIONS",
  "CAT5_REGRESSION_ILLNESS_CRISIS",
  "CAT6_NEWBORN_DAY_NIGHT_ACTIVE_SLEEP",
  "CAT7_NIGHT_WEANING_FEEDING",
] as const;

interface ChildOption {
  readonly id: string;
  readonly name: string;
  readonly household_name: string | null;
}

const STATUS_STYLE: Record<AiCallStatus, string> = {
  ok: "text-emerald-400",
  error: "text-red-400",
  invalid_json: "text-amber-400",
};

/**
 * Prezentuje blok JSON w rozwijanym podglądzie.
 *
 * @param {object} props - Tytuł i dane
 * @returns {ReactNode} Sekcja z `<pre>`
 */
function JsonBlock({ title, value }: { title: string; value: unknown }): ReactNode {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs uppercase tracking-wider text-slate-400">{title}</p>
      <pre className="max-h-60 overflow-auto rounded-lg bg-black/30 p-2 text-xs text-slate-300">
        {JSON.stringify(value ?? null, null, 2)}
      </pre>
    </div>
  );
}

/**
 * Czy wywołanie ma zapisany pełny kontekst (potrzebny do ponownego uruchomienia).
 *
 * @param {AiCallRecord} call - Wpis z ai_calls
 * @returns {boolean} True, gdy można odtworzyć wywołanie
 */
function canReplay(call: AiCallRecord): boolean {
  return Boolean(call.request_snapshot_json && "context" in call.request_snapshot_json);
}

/**
 * Panel "Odtwórz z innym promptem": ponownie uruchamia zapisany kontekst i pokazuje wyniki obok siebie.
 *
 * @param {object} props - Identyfikator wywołania
 * @returns {ReactNode} Panel ponownego uruchomienia
 */
function ReplayPanel({ callId }: { callId: string }): ReactNode {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("");
  const [result, setResult] = useState<ReplayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = async () => {
    setIsRunning(true);
    setError(null);
    try {
      setResult(
        await adminRequest<ReplayResponse>(`/api/admin/ai-calls/${callId}/replay`, {
          method: "POST",
          ...jsonBody({ prompt: prompt || undefined, model: model.trim() || undefined }),
        }),
      );
    } catch (replayError) {
      setError(replayError instanceof Error ? replayError.message : "Błąd ponownego uruchomienia.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-violet-500/20 p-2">
      <p className="text-xs uppercase tracking-wider text-violet-300">
        Odtwórz z innym promptem / modelem
      </p>
      <input
        className={inputClass}
        aria-label="Model do odtworzenia"
        placeholder="Model (pusty = ustawiony w konfiguracji)"
        value={model}
        onChange={(event) => setModel(event.target.value)}
      />
      <textarea
        className={`${inputClass} min-h-24 font-mono text-xs`}
        aria-label="Prompt do odtworzenia"
        placeholder="Prompt systemowy (pusty = aktywny)"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
      />
      <PrimaryButton onClick={handleRun} disabled={isRunning}>
        {isRunning ? "Uruchamianie…" : "Uruchom ponownie"}
      </PrimaryButton>
      {error && <StatusMessage error={error} />}
      {result && (
        <div className="grid gap-2 sm:grid-cols-2">
          <JsonBlock
            title={`Oryginał (${result.original.model ?? "?"})`}
            value={result.original.response}
          />
          <JsonBlock
            title={`Nowy wynik (${result.replay.model}, ${result.replay.status}, ${result.replay.latencyMs} ms)`}
            value={result.replay.insight}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Tabela jakości (accepted / corrected / pending) dla jednego wymiaru grupowania.
 *
 * @param {object} props - Tytuł i wiersze
 * @returns {ReactNode} Tabela
 */
function QualityTable({
  title,
  rows,
  labelKey,
}: {
  title: string;
  rows: readonly QualityRow[];
  labelKey?: (key: string) => string;
}): ReactNode {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#151B28] p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">Brak ocenionych wniosków.</p>
      ) : (
        <table className="w-full text-xs text-slate-300">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-slate-400">
              <th className="pb-1 text-left font-medium">Klucz</th>
              <th className="pb-1 text-right font-medium">Razem</th>
              <th className="pb-1 text-right font-medium">👍</th>
              <th className="pb-1 text-right font-medium">✏️</th>
              <th className="pb-1 text-right font-medium">…</th>
              <th className="pb-1 text-right font-medium">Akcept.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-slate-800">
                <th scope="row" className="py-1.5 text-left font-medium">
                  {labelKey ? labelKey(row.key) : row.key}
                </th>
                <td className="text-right">{row.total}</td>
                <td className="text-right">{row.accepted}</td>
                <td className="text-right">{row.corrected}</td>
                <td className="text-right">{row.pending}</td>
                <td className="text-right">
                  {row.acceptanceRate === null ? "—" : `${Math.round(row.acceptanceRate * 100)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/**
 * Widok "Jakość": skuteczność wniosków per kategoria i wersja promptu oraz korekty rodziców.
 *
 * @returns {ReactNode} Widok jakości
 */
function QualityView({ categoryLabel }: { categoryLabel: (code: string) => string }): ReactNode {
  const [data, setData] = useState<QualityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminRequest<QualityResponse>("/api/admin/ai-quality")
      .then(setData)
      .catch((loadError: unknown) =>
        setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać jakości."),
      );
  }, []);

  if (!data) return <StatusMessage error={error} loading="Ładowanie…" />;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-400">Przeanalizowano wniosków: {data.analyzed}.</p>
      <QualityTable title="Wg kategorii" rows={data.report.byCategory} labelKey={categoryLabel} />
      <QualityTable title="Wg wersji promptu" rows={data.report.byPromptVersion} />
      <div className="rounded-xl border border-slate-800 bg-[#151B28] p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Ostatnie korekty rodziców
        </h3>
        {data.corrections.length === 0 && (
          <p className="text-xs text-slate-400">Brak korekt z komentarzem.</p>
        )}
        <ul className="flex flex-col gap-2">
          {data.corrections.map((correction) => (
            <li key={correction.id} className="rounded-lg border border-slate-800 p-2 text-xs">
              <p className="font-medium text-slate-200">{correction.title}</p>
              <p className="text-slate-300">„{correction.note}”</p>
              <p className="text-xs text-slate-400">
                {categoryLabel(correction.category)} · {correction.feedback ?? "—"} ·{" "}
                {new Date(correction.updated).toLocaleString("pl-PL")}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Zakładka "Inspektor Wniosków": filtry, silnik → JSON modelu → reakcja rodzica, replay i jakość.
 *
 * @returns {ReactNode} Zawartość zakładki
 */
export function InspectorTab({ initialUserId = "" }: { initialUserId?: string }): ReactNode {
  const [view, setView] = useState<"calls" | "quality">("calls");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS, user: initialUserId });
  const [data, setData] = useState<CallsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [children, setChildren] = useState<readonly ChildOption[]>([]);
  const { tDynamic } = useI18n();
  const categoryLabel = (code: string) => tDynamic(`insights.cat.${code}`, code);

  useEffect(() => {
    adminRequest<{ items: readonly ChildOption[] }>("/api/admin/children?perPage=50")
      .then((result) => setChildren(result.items))
      .catch(() => setChildren([]));
  }, []);

  const load = useCallback(async () => {
    try {
      const query = new URLSearchParams({ page: String(page), perPage: "20" });
      if (filters.status) query.set("status", filters.status);
      if (filters.household.trim()) query.set("household_id", filters.household.trim());
      if (filters.user.trim()) query.set("user_id", filters.user.trim());
      if (filters.child.trim()) query.set("child_id", filters.child.trim());
      if (filters.category.trim()) query.set("category", filters.category.trim());
      if (filters.model.trim()) query.set("model", filters.model.trim());
      if (filters.from) query.set("from", new Date(`${filters.from}T00:00:00`).toISOString());
      if (filters.to) query.set("to", new Date(`${filters.to}T23:59:59`).toISOString());
      setData(await adminRequest<CallsPage>(`/api/admin/ai-calls?${query}`));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać logu.");
    }
  }, [page, filters]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {(
          [
            ["calls", "Wywołania"],
            ["quality", "Jakość"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={view === id}
            className={`min-h-11 rounded-full border px-4 text-xs ${
              view === id
                ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                : "border-slate-800 text-slate-400"
            }`}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "quality" && <QualityView categoryLabel={categoryLabel} />}

      {view === "calls" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <select
              className={inputClass}
              aria-label="Filtr statusu"
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value as "" | AiCallStatus)}
            >
              <option value="">Wszystkie statusy</option>
              <option value="ok">ok</option>
              <option value="error">error</option>
              <option value="invalid_json">invalid_json</option>
            </select>
            <select
              className={inputClass}
              aria-label="Filtr kategorii"
              value={filters.category}
              onChange={(event) => updateFilter("category", event.target.value)}
            >
              <option value="">Wszystkie kategorie</option>
              {CATEGORY_CODES.map((code) => (
                <option key={code} value={code}>
                  {categoryLabel(code)}
                </option>
              ))}
            </select>
            <input
              className={inputClass}
              aria-label="Filtr modelu"
              placeholder="Model"
              value={filters.model}
              onChange={(event) => updateFilter("model", event.target.value)}
            />
            <input
              className={inputClass}
              aria-label="Filtr gospodarstwa"
              placeholder="ID gospodarstwa"
              value={filters.household}
              onChange={(event) => updateFilter("household", event.target.value)}
            />
            <input
              className={inputClass}
              aria-label="Filtr użytkownika"
              placeholder="ID użytkownika"
              value={filters.user}
              onChange={(event) => updateFilter("user", event.target.value)}
            />
            <select
              className={inputClass}
              aria-label="Filtr dziecka"
              value={filters.child}
              onChange={(event) => updateFilter("child", event.target.value)}
            >
              <option value="">Wszystkie dzieci</option>
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.household_name ? `${child.name} (${child.household_name})` : child.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                className={inputClass}
                type="date"
                aria-label="Od daty"
                value={filters.from}
                onChange={(event) => updateFilter("from", event.target.value)}
              />
              <input
                className={inputClass}
                type="date"
                aria-label="Do daty"
                value={filters.to}
                onChange={(event) => updateFilter("to", event.target.value)}
              />
            </div>
          </div>

          <StatusMessage error={error} loading={data ? undefined : "Ładowanie…"} />
          {data?.items.length === 0 && <p className="text-sm text-slate-400">Brak wywołań AI.</p>}

          {data?.items.map((call) => (
            <details key={call.id} className="rounded-xl border border-slate-800 bg-[#151B28] p-3">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-xs">
                <span className={`font-semibold ${STATUS_STYLE[call.status]}`}>{call.status}</span>
                <span className="text-slate-400">{call.kind}</span>
                <span className="text-slate-400">{call.model}</span>
                {call.fallback_used && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
                    fallback
                  </span>
                )}
                {call.prompt_version ? (
                  <span className="text-xs text-slate-400">v{call.prompt_version}</span>
                ) : null}
                <span className="ml-auto text-slate-400">
                  {new Date(call.created).toLocaleString()} · {call.latency_ms ?? "—"} ms
                </span>
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                <JsonBlock title="1. Silnik deterministyczny" value={call.request_snapshot_json} />
                <JsonBlock title="2. Odpowiedź modelu" value={call.response_json} />
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-slate-400">
                    3. Reakcja rodzica
                  </p>
                  {call.insight ? (
                    <p className="text-xs text-slate-300">
                      „{call.insight.title}” — {call.insight.parent_feedback ?? "pending"}
                      {call.insight.parent_correction_note
                        ? ` (${call.insight.parent_correction_note})`
                        : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">Brak powiązanego wniosku.</p>
                  )}
                </div>
                {call.error_message && <StatusMessage error={call.error_message} />}
                <p className="text-xs text-slate-400">
                  Tokeny: {call.prompt_tokens ?? "—"} / {call.completion_tokens ?? "—"}
                  {call.category ? ` · ${categoryLabel(call.category)}` : ""}
                </p>
                {canReplay(call) ? (
                  <ReplayPanel callId={call.id} />
                ) : (
                  <p className="text-xs text-slate-400">
                    Brak zapisanego pełnego kontekstu — tego wywołania nie można odtworzyć.
                  </p>
                )}
              </div>
            </details>
          ))}

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-400">
              <button
                type="button"
                className="min-h-11 px-3 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                ← Nowsze
              </button>
              <span>
                {data.page} / {data.totalPages}
              </span>
              <button
                type="button"
                className="min-h-11 px-3 disabled:opacity-40"
                disabled={page >= data.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Starsze →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
