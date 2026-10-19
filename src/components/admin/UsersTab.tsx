"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { adminRequest, jsonBody } from "./adminApi";
import { inputClass, StatusMessage } from "./ui";

interface UserRow {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly is_admin: boolean;
  readonly is_blocked: boolean;
  readonly household_id: string | null;
  readonly last_seen_at: string | null;
  readonly created: string;
}

interface UsersPage {
  readonly items: readonly UserRow[];
  readonly page: number;
  readonly totalPages: number;
  readonly totalItems: number;
}

type RoleFilter = "all" | "admin" | "blocked";

const FILTERS: readonly { id: RoleFilter; label: string }[] = [
  { id: "all", label: "Wszyscy" },
  { id: "admin", label: "Admini" },
  { id: "blocked", label: "Zablokowani" },
];

/**
 * Formatuje datę ISO do czytelnej postaci lokalnej lub zwraca myślnik.
 *
 * @param {string | null} iso - Data ISO
 * @returns {string} Tekst do wyświetlenia
 */
function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("pl-PL") : "—";
}

/**
 * Karta użytkownika z przełącznikami admin/blokada i usunięciem konta (potwierdzenie e-mailem).
 *
 * @param {object} props - Dane użytkownika i callbacki akcji
 * @returns {ReactNode} Karta
 */
function UserCard({
  row,
  onToggle,
  onDelete,
}: {
  row: UserRow;
  onToggle: (id: string, patch: { is_admin?: boolean; is_blocked?: boolean }) => Promise<void>;
  onDelete: (row: UserRow, confirmEmail: string) => Promise<void>;
}): ReactNode {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-[#151B28] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold text-slate-100">{row.email}</h3>
        <span className="shrink-0 text-[11px] text-slate-500">{row.name}</span>
      </div>
      <p className="text-[11px] text-slate-500">
        Rejestracja: {formatDate(row.created)} · Ostatnio: {formatDate(row.last_seen_at)}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={row.is_admin}
          className={`min-h-11 rounded-xl border px-3 text-xs font-medium ${
            row.is_admin
              ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
              : "border-slate-700 text-slate-300"
          }`}
          onClick={() => onToggle(row.id, { is_admin: !row.is_admin })}
        >
          {row.is_admin ? "Admin ✓" : "Nadaj admina"}
        </button>
        <button
          type="button"
          aria-pressed={row.is_blocked}
          className={`min-h-11 rounded-xl border px-3 text-xs font-medium ${
            row.is_blocked
              ? "border-red-500/50 bg-red-500/10 text-red-300"
              : "border-slate-700 text-slate-300"
          }`}
          onClick={() => onToggle(row.id, { is_blocked: !row.is_blocked })}
        >
          {row.is_blocked ? "Zablokowany — odblokuj" : "Zablokuj"}
        </button>
        <button
          type="button"
          className="min-h-11 rounded-xl border border-slate-700 px-3 text-xs text-red-300"
          onClick={() => setIsDeleting((value) => !value)}
        >
          Usuń konto…
        </button>
      </div>
      {isDeleting && (
        <div className="flex flex-col gap-2 rounded-lg bg-red-500/5 p-2">
          <p className="text-xs text-red-300">
            Operacja nieodwracalna. Jeśli to ostatni członek gospodarstwa, usunięte zostaną też
            dzieci i ich dane. Wpisz e-mail konta, aby potwierdzić.
          </p>
          <input
            className={inputClass}
            type="email"
            aria-label={`Potwierdź e-mail — ${row.email}`}
            placeholder={row.email}
            value={confirmEmail}
            onChange={(event) => setConfirmEmail(event.target.value)}
          />
          <button
            type="button"
            disabled={confirmEmail.trim().toLowerCase() !== row.email.toLowerCase()}
            className="min-h-11 rounded-xl bg-red-500/80 px-4 text-sm font-semibold text-white disabled:opacity-40"
            onClick={() => onDelete(row, confirmEmail)}
          >
            Usuń na stałe
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Zakładka "Użytkownicy": lista z wyszukiwarką, filtrem roli i akcjami administracyjnymi.
 *
 * @returns {ReactNode} Zawartość zakładki
 */
export function UsersTab(): ReactNode {
  const [data, setData] = useState<UsersPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), filter });
      if (search.trim()) params.set("search", search.trim());
      setData(await adminRequest<UsersPage>(`/api/admin/users?${params.toString()}`));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać listy.");
    }
  }, [page, filter, search]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const handleToggle = async (id: string, patch: { is_admin?: boolean; is_blocked?: boolean }) => {
    try {
      await adminRequest(`/api/admin/users/${id}`, { method: "PATCH", ...jsonBody(patch) });
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Operacja nie powiodła się.");
    }
  };

  const handleDelete = async (row: UserRow, confirmEmail: string) => {
    try {
      await adminRequest(`/api/admin/users/${row.id}`, {
        method: "DELETE",
        ...jsonBody({ confirmEmail }),
      });
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Nie udało się usunąć konta.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        className={inputClass}
        type="search"
        aria-label="Szukaj użytkownika"
        placeholder="Szukaj po e-mailu lub nazwie"
        value={search}
        onChange={(event) => {
          setPage(1);
          setSearch(event.target.value);
        }}
      />
      <div className="flex gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={filter === option.id}
            className={`min-h-11 rounded-full border px-4 text-xs ${
              filter === option.id
                ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                : "border-slate-800 text-slate-400"
            }`}
            onClick={() => {
              setPage(1);
              setFilter(option.id);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <StatusMessage error={error} loading={data || error ? undefined : "Ładowanie…"} />
      {data?.items.length === 0 && <p className="text-sm text-slate-400">Brak użytkowników.</p>}
      {data?.items.map((row) => (
        <UserCard key={row.id} row={row} onToggle={handleToggle} onDelete={handleDelete} />
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
            {data.page} / {data.totalPages} ({data.totalItems})
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
