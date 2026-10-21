"use client";

import { Loader2, LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { authorizedFetch } from "@/lib/client-data";
import { signOutUser } from "@/lib/pocketbase";
import type { UserRecord } from "@/lib/types/database";
import { SettingsCard } from "./SettingsCard";

const HTTP_CONFLICT = 409;

/**
 * Wylogowanie oraz trwałe usunięcie własnego konta (RODO) z potwierdzeniem e-mailem.
 *
 * @param {object} props - Zalogowany użytkownik
 * @returns {ReactNode} Karta zarządzania kontem
 */
export function AccountSection({ user }: { readonly user: UserRecord }): ReactNode {
  const { t } = useI18n();
  const router = useRouter();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailMatches = confirmEmail.trim().toLowerCase() === user.email.toLowerCase();

  const handleSignOut = () => {
    signOutUser();
    router.replace("/login");
  };

  const handleDelete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!emailMatches) return;
    setIsDeleting(true);
    setError(null);
    try {
      const response = await authorizedFetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: confirmEmail.trim() }),
      });
      if (!response.ok) {
        setError(
          response.status === HTTP_CONFLICT
            ? t("settings.delete.adminBlocked")
            : t("settings.delete.failed"),
        );
        return;
      }
      signOutUser();
      router.replace("/login");
    } catch {
      setError(t("settings.delete.failed"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SettingsCard title={t("settings.account")}>
      <button
        type="button"
        onClick={handleSignOut}
        className="flex items-center justify-center gap-2 rounded-xl border border-[#263348] bg-[#1E2738] py-3 text-sm font-medium text-slate-200 hover:bg-[#263348] transition-colors"
      >
        <LogOut className="w-4 h-4" />
        {t("settings.signOut")}
      </button>

      {!isDeleteOpen ? (
        <button
          type="button"
          onClick={() => setIsDeleteOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-medium text-red-300/80 hover:text-red-300 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {t("settings.delete.title")}
        </button>
      ) : (
        <form
          onSubmit={handleDelete}
          className="flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-3"
        >
          <p className="text-xs leading-relaxed text-red-200/90">
            {t("settings.delete.description")}
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">
              {t("settings.delete.confirmLabel", { email: user.email })}
            </span>
            <input
              type="email"
              value={confirmEmail}
              autoComplete="off"
              onChange={(event) => setConfirmEmail(event.target.value)}
              className="w-full rounded-xl border border-[#263348] bg-[#0B0F17] px-3 py-2 text-sm text-ink focus:border-red-500/60 focus:outline-none"
            />
          </label>
          {error && (
            <p role="alert" className="text-xs text-red-300">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIsDeleteOpen(false);
                setConfirmEmail("");
                setError(null);
              }}
              className="flex-1 rounded-xl border border-[#263348] py-2 text-xs font-medium text-slate-300"
            >
              {t("settings.delete.cancel")}
            </button>
            <button
              type="submit"
              disabled={!emailMatches || isDeleting}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-500 py-2 text-xs font-semibold text-white transition-opacity disabled:opacity-40"
            >
              {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isDeleting ? t("settings.delete.deleting") : t("settings.delete.confirm")}
            </button>
          </div>
        </form>
      )}
    </SettingsCard>
  );
}
