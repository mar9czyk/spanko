"use client";

import { type ReactNode, useEffect, useState } from "react";
import { pb } from "@/lib/pocketbase";

interface Announcement {
  readonly id: string;
  readonly message: string;
  readonly level: "info" | "warning";
}

const DISMISSED_STORAGE_KEY = "spanko.dismissedAnnouncements";

function readDismissed(): string[] {
  try {
    const raw = window.sessionStorage.getItem(DISMISSED_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeDismissed(ids: readonly string[]): void {
  try {
    window.sessionStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Zablokowane dane witryny — zamknięcie banera działa tylko do odświeżenia
  }
}

/**
 * Baner z aktywnymi ogłoszeniami od admina (np. przerwa techniczna).
 *
 * @description
 * Okno czasu i aktywność filtruje reguła kolekcji `announcements` po stronie PocketBase.
 * Zamknięcie banera jest pamiętane do końca sesji przeglądarki. Błąd pobierania jest ignorowany —
 * ogłoszenia nigdy nie blokują dashboardu.
 *
 * @returns {ReactNode} Lista banerów albo null
 */
export function AnnouncementBanner(): ReactNode {
  const [items, setItems] = useState<readonly Announcement[]>([]);
  const [dismissed, setDismissed] = useState<readonly string[]>([]);

  useEffect(() => {
    setDismissed(readDismissed());
    pb.collection("announcements")
      .getFullList<Announcement>({ sort: "-created", fields: "id,message,level" })
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const visible = items.filter((item) => !dismissed.includes(item.id));
  if (visible.length === 0) return null;

  const handleDismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    writeDismissed(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {visible.map((item) => (
        <div
          key={item.id}
          role="status"
          className={`flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-xs ${
            item.level === "warning"
              ? "bg-amber-500/10 text-amber-300"
              : "bg-violet-500/10 text-violet-200"
          }`}
        >
          <span>{item.message}</span>
          <button
            type="button"
            aria-label="Zamknij ogłoszenie"
            className="-m-2 min-h-11 min-w-11 shrink-0 text-base leading-none opacity-70"
            onClick={() => handleDismiss(item.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
