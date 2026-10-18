"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { HouseholdsTab } from "@/components/admin/HouseholdsTab";
import { InspectorTab } from "@/components/admin/InspectorTab";
import { MatrixTab } from "@/components/admin/MatrixTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { pb } from "@/lib/pocketbase";

const TABS = [
  { id: "settings", label: "OpenRouter & Prompty" },
  { id: "inspector", label: "Inspektor Wniosków" },
  { id: "matrix", label: "Matryca Snu" },
  { id: "households", label: "Gospodarstwa" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * Panel Admina (`user.is_admin === true`).
 *
 * @description
 * Przekierowanie nie-adminów na /dashboard jest tylko wygodą UI — faktyczna ochrona to
 * `requireAdmin` w każdym endponcie `/api/admin/*` oraz reguły kolekcji PocketBase.
 *
 * @returns {ReactNode} Strona panelu admina
 */
export default function AdminPage(): ReactNode {
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("settings");

  useEffect(() => {
    if (pb.authStore.record?.is_admin === true) {
      setIsAllowed(true);
    } else {
      router.replace("/dashboard");
    }
  }, [router]);

  if (!isAllowed) {
    return (
      <main className="w-full p-6 text-sm text-slate-400" role="status">
        Sprawdzanie uprawnień…
      </main>
    );
  }

  return (
    <main className="w-full flex flex-col gap-4 pb-8">
      <h1 className="text-lg font-semibold text-slate-100">Panel Admina</h1>
      <div role="tablist" className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-xs font-medium ${
              activeTab === tab.id
                ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                : "border-slate-800 text-slate-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "settings" && <SettingsTab />}
      {activeTab === "inspector" && <InspectorTab />}
      {activeTab === "matrix" && <MatrixTab />}
      {activeTab === "households" && <HouseholdsTab />}
    </main>
  );
}
