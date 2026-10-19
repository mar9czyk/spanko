import { getServiceClient } from "@/lib/server/auth";
import type { UserRecord } from "@/lib/types/database";

export interface AuditEntry {
  readonly actor: Pick<UserRecord, "id" | "email">;
  /** Nazwa akcji, np. `user.set_admin`, `settings.update`, `child.view` */
  readonly action: string;
  readonly targetCollection?: string;
  readonly targetId?: string;
  readonly before?: unknown;
  readonly after?: unknown;
}

/**
 * Zapisuje wpis w dzienniku działań admina (`admin_audit_log`) kontem serwisowym.
 *
 * @description
 * Best effort: brak konta serwisowego lub błąd zapisu nie przerywa operacji admina,
 * ale jest zgłaszany w logu serwera (żeby brak audytu nie był niewidoczny).
 *
 * @param {AuditEntry} entry - Opis wykonanej akcji
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const service = await getServiceClient();
    if (!service) {
      console.warn(`[audit] brak konta serwisowego — pominięto wpis ${entry.action}`);
      return;
    }
    await service.collection("admin_audit_log").create({
      actor_id: entry.actor.id,
      actor_email: entry.actor.email,
      action: entry.action,
      target_collection: entry.targetCollection ?? "",
      target_id: entry.targetId ?? "",
      before_json: entry.before ?? null,
      after_json: entry.after ?? null,
    });
  } catch (error) {
    console.error(`[audit] nie udało się zapisać wpisu ${entry.action}`, error);
  }
}
