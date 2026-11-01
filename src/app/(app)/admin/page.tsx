"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { AuditTab } from "@/components/admin/AuditTab";
import { CalibrationTab } from "@/components/admin/CalibrationTab";
import { ChildrenTab } from "@/components/admin/ChildrenTab";
import { ContentTab } from "@/components/admin/ContentTab";
import { DashboardTab } from "@/components/admin/DashboardTab";
import { HouseholdsTab } from "@/components/admin/HouseholdsTab";
import { InspectorTab } from "@/components/admin/InspectorTab";
import { MatrixTab } from "@/components/admin/MatrixTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { SystemTab } from "@/components/admin/SystemTab";
import { UsageTab } from "@/components/admin/UsageTab";
import { UsersTab } from "@/components/admin/UsersTab";
import { pb } from "@/lib/pocketbase";

const TAB_GROUPS = [
  { label: "Przegląd", tabs: [{ id: "dashboard", label: "Pulpit" }] },
  {
    label: "Ludzie i dane",
    tabs: [
      { id: "users", label: "Użytkownicy" },
      { id: "households", label: "Gospodarstwa" },
      { id: "children", label: "Dzieci" },
    ],
  },
  {
    label: "AI i silnik",
    tabs: [
      { id: "settings", label: "OpenRouter & Prompty" },
      { id: "inspector", label: "Inspektor Wniosków" },
      { id: "usage", label: "Telemetria" },
      { id: "matrix", label: "Matryca Snu" },
      { id: "calibration", label: "Trafność prognoz" },
    ],
  },
  {
    label: "Aplikacja",
    tabs: [
      { id: "content", label: "Treści i ogłoszenia" },
      { id: "system", label: "System" },
      { id: "audit", label: "Dziennik działań" },
    ],
  },
] as const;

type TabId = (typeof TAB_GROUPS)[number]["tabs"][number]["id"];

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
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [inspectorUserId, setInspectorUserId] = useState("");

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
    <main className="selectable w-full flex flex-col gap-4 pb-8">
      <h1 className="text-lg font-semibold text-ink">Panel Admina</h1>
      {/* 11 sekcji nie mieści się w pasku zakładek na telefonie — rozwijana lista jest czytelniejsza */}
      <select
        aria-label="Sekcja panelu"
        className="min-h-11 w-full rounded-xl border border-amber-500/40 bg-[#151B28] px-3 text-sm font-medium text-amber-200"
        value={activeTab}
        onChange={(event) => setActiveTab(event.target.value as TabId)}
      >
        {TAB_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.tabs.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {activeTab === "dashboard" && <DashboardTab />}
      {activeTab === "users" && <UsersTab />}
      {activeTab === "households" && <HouseholdsTab />}
      {activeTab === "children" && <ChildrenTab />}
      {activeTab === "settings" && <SettingsTab />}
      {activeTab === "inspector" && (
        <InspectorTab key={inspectorUserId} initialUserId={inspectorUserId} />
      )}
      {activeTab === "usage" && (
        <UsageTab
          onOpenInspector={(userId) => {
            setInspectorUserId(userId);
            setActiveTab("inspector");
          }}
        />
      )}
      {activeTab === "matrix" && <MatrixTab />}
      {activeTab === "calibration" && <CalibrationTab />}
      {activeTab === "content" && <ContentTab />}
      {activeTab === "system" && <SystemTab />}
      {activeTab === "audit" && <AuditTab />}
    </main>
  );
}
