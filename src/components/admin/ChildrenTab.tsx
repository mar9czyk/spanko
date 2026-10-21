"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { formatDuration } from "@/i18n/translate";
import { adminRequest, jsonBody } from "./adminApi";
import { inputClass, PrimaryButton, StatusMessage } from "./ui";

interface ChildListItem {
  readonly id: string;
  readonly name: string;
  readonly birth_date: string;
  readonly household_name: string | null;
  readonly active_day_mode: string;
}

interface ChildrenPage {
  readonly items: readonly ChildListItem[];
  readonly page: number;
  readonly totalPages: number;
}

interface ProfileLog {
  readonly id: string;
  readonly physiological_date: string;
  readonly type: string;
  readonly status: string;
  readonly put_down_at: string | null;
  readonly fell_asleep_at: string | null;
  readonly woke_up_at: string | null;
  readonly night_wakings: number;
}

interface ChildProfile {
  readonly child: {
    readonly id: string;
    readonly name: string;
    readonly birth_date: string;
    readonly due_date?: string;
    readonly active_day_mode: string;
  };
  readonly logs: readonly ProfileLog[];
}

interface EngineResult {
  readonly effectiveAgeDays: number;
  readonly chronicDrive: {
    readonly individualSleepNeedMin: number;
    readonly chronicSleepDebtMin: number;
    readonly sleepBatteryPercent: number;
    readonly sleepNeedsProfile: string;
  };
  readonly diagnostics: readonly {
    readonly category: string;
    readonly diagnosisCode: string;
    readonly isTriggered: boolean;
    readonly severity: string;
    readonly title: string;
    readonly explanation: string;
  }[];
}

const STUCK_AGE_MS = 86_400_000;

/**
 * Formatuje czas ISO do lokalnej daty i godziny albo myślnik.
 *
 * @param {string | null} iso - Czas ISO
 * @returns {string} Tekst do wyświetlenia
 */
function formatTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("pl-PL") : "—";
}

/**
 * Konwertuje wartość `datetime-local` (czas lokalny) do ISO UTC.
 *
 * @param {string} local - Wartość z pola datetime-local
 * @returns {string} Czas ISO UTC
 */
function localInputToIso(local: string): string {
  return new Date(local).toISOString();
}

/**
 * Wiersz logu snu; dla zawieszonego snu (>24 h bez zakończenia) pokazuje formularz naprawy.
 *
 * @param {object} props - Log i callback po naprawie
 * @returns {ReactNode} Wiersz logu
 */
function LogRow({ log, onFixed }: { log: ProfileLog; onFixed: () => void }): ReactNode {
  const start = log.fell_asleep_at || log.put_down_at;
  const isStuck =
    log.status !== "completed" &&
    start !== null &&
    Date.now() - new Date(start).getTime() > STUCK_AGE_MS;
  const [wokeUpLocal, setWokeUpLocal] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFix = async () => {
    if (!wokeUpLocal) return;
    if (
      !window.confirm("Zakończyć ten sen podaną pobudką? Operacja zostanie zapisana w dzienniku.")
    ) {
      return;
    }
    try {
      await adminRequest(`/api/admin/sleep-logs/${log.id}`, {
        method: "PATCH",
        ...jsonBody({ wokeUpAt: localInputToIso(wokeUpLocal), confirm: true }),
      });
      onFixed();
    } catch (fixError) {
      setError(fixError instanceof Error ? fixError.message : "Nie udało się naprawić snu.");
    }
  };

  return (
    <li className="rounded-lg border border-slate-800 p-2 text-xs text-slate-300">
      <p>
        <span className="font-medium text-ink">{log.physiological_date}</span> · {log.type} ·{" "}
        <span className={log.status === "completed" ? "text-emerald-400" : "text-amber-300"}>
          {log.status}
        </span>
        {log.night_wakings > 0 ? ` · pobudki: ${log.night_wakings}` : ""}
      </p>
      <p className="text-xs text-slate-400">
        {formatTime(start)} → {formatTime(log.woke_up_at)}
      </p>
      {isStuck && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg bg-amber-500/5 p-2">
          <p className="text-xs text-amber-300">
            Zawieszony sen (&gt; 24 h bez zakończenia). Podaj czas pobudki, aby go zamknąć.
          </p>
          <input
            className={inputClass}
            type="datetime-local"
            aria-label="Czas pobudki"
            value={wokeUpLocal}
            onChange={(event) => setWokeUpLocal(event.target.value)}
          />
          <PrimaryButton onClick={handleFix} disabled={!wokeUpLocal}>
            Zakończ sen
          </PrimaryButton>
          {error && <StatusMessage error={error} />}
        </div>
      )}
    </li>
  );
}

/**
 * Widok profilu dziecka: dane, logi z 14 dób i "Przelicz silnik" (bez AI).
 *
 * @param {object} props - Identyfikator dziecka i callback powrotu
 * @returns {ReactNode} Profil
 */
function ChildProfileView({ childId, onBack }: { childId: string; onBack: () => void }): ReactNode {
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [engine, setEngine] = useState<EngineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComputing, setIsComputing] = useState(false);

  const load = useCallback(async () => {
    try {
      setProfile(await adminRequest<ChildProfile>(`/api/admin/children/${childId}`));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać profilu.");
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRecompute = async () => {
    setIsComputing(true);
    try {
      setEngine(
        await adminRequest<EngineResult>(`/api/admin/children/${childId}`, { method: "POST" }),
      );
      setError(null);
    } catch (computeError) {
      setError(computeError instanceof Error ? computeError.message : "Błąd obliczeń.");
    } finally {
      setIsComputing(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button type="button" className="min-h-11 self-start text-xs text-slate-400" onClick={onBack}>
        ← Wszystkie dzieci
      </button>
      <StatusMessage error={error} loading={profile || error ? undefined : "Ładowanie…"} />
      {profile && (
        <>
          <div className="rounded-xl border border-slate-800 bg-[#151B28] p-3">
            <h3 className="text-sm font-semibold text-ink">{profile.child.name}</h3>
            <p className="text-xs text-slate-400">
              ur. {profile.child.birth_date.slice(0, 10)}
              {profile.child.due_date ? ` · termin ${profile.child.due_date.slice(0, 10)}` : ""} ·
              tryb dnia: {profile.child.active_day_mode}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Podgląd tylko do odczytu — otwarcie profilu zapisało wpis w dzienniku działań.
            </p>
          </div>

          <PrimaryButton onClick={handleRecompute} disabled={isComputing}>
            {isComputing ? "Liczenie…" : "Przelicz silnik (bez AI)"}
          </PrimaryButton>
          {engine && (
            <div className="rounded-xl border border-violet-500/20 bg-[#151B28] p-3 text-xs text-slate-300">
              <p>
                Wiek efektywny: <b>{engine.effectiveAgeDays} dni</b> · bateria snu:{" "}
                <b>{engine.chronicDrive.sleepBatteryPercent}%</b> · dług:{" "}
                <b>{formatDuration(engine.chronicDrive.chronicSleepDebtMin)}</b> · norma:{" "}
                <b>{formatDuration(engine.chronicDrive.individualSleepNeedMin)}</b> (
                {engine.chronicDrive.sleepNeedsProfile})
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {engine.diagnostics.map((diag) => (
                  <li
                    key={`${diag.category}:${diag.diagnosisCode}`}
                    className={`rounded-lg p-2 ${diag.isTriggered ? "bg-amber-500/10" : "bg-black/20"}`}
                  >
                    <p className="font-medium text-ink">
                      {diag.isTriggered ? "⚠ " : "✓ "}
                      {diag.title}{" "}
                      <span className="text-xs text-slate-400">
                        {diag.category} · {diag.severity}
                      </span>
                    </p>
                    {diag.isTriggered && <p className="text-slate-400">{diag.explanation}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Logi snu — ostatnie 14 dób ({profile.logs.length})
          </h3>
          <ul className="flex flex-col gap-1.5">
            {profile.logs.map((log) => (
              <LogRow key={log.id} log={log} onFixed={load} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * Zakładka "Dzieci": wyszukiwarka dzieci, profil tylko do odczytu, przeliczenie silnika i naprawa snu.
 *
 * @returns {ReactNode} Zawartość zakładki
 */
export function ChildrenTab(): ReactNode {
  const [data, setData] = useState<ChildrenPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search.trim()) params.set("search", search.trim());
      setData(await adminRequest<ChildrenPage>(`/api/admin/children?${params.toString()}`));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać listy.");
    }
  }, [page, search]);

  useEffect(() => {
    if (selectedId) return;
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load, selectedId]);

  if (selectedId) {
    return <ChildProfileView childId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        className={inputClass}
        type="search"
        aria-label="Szukaj dziecka"
        placeholder="Szukaj po imieniu"
        value={search}
        onChange={(event) => {
          setPage(1);
          setSearch(event.target.value);
        }}
      />
      <StatusMessage error={error} loading={data || error ? undefined : "Ładowanie…"} />
      {data?.items.length === 0 && <p className="text-sm text-slate-400">Brak dzieci.</p>}
      {data?.items.map((child) => (
        <button
          key={child.id}
          type="button"
          className="min-h-11 rounded-xl border border-slate-800 bg-[#151B28] p-3 text-left"
          onClick={() => setSelectedId(child.id)}
        >
          <span className="block text-sm font-semibold text-ink">{child.name}</span>
          <span className="block text-xs text-slate-400">
            {child.household_name ?? "—"} · ur. {child.birth_date.slice(0, 10)} ·{" "}
            {child.active_day_mode}
          </span>
        </button>
      ))}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <button
            type="button"
            disabled={page <= 1}
            className="min-h-11 rounded-xl border border-slate-800 px-4 disabled:opacity-40"
            onClick={() => setPage((value) => value - 1)}
          >
            ← Poprzednia
          </button>
          <span>
            {data.page} / {data.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= data.totalPages}
            className="min-h-11 rounded-xl border border-slate-800 px-4 disabled:opacity-40"
            onClick={() => setPage((value) => value + 1)}
          >
            Następna →
          </button>
        </div>
      )}
    </div>
  );
}
