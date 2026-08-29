import type { UserRecord } from "../db/repositories/userRepository";
import { t } from "../i18n/t";

/**
 * Formats a single admin as a "card" string showing their position within
 * the paginated admin list, name, username, and Telegram ID.
 */
export function formatAdminCard(admin: UserRecord, position: number, total: number): string {
  return t("admin.list.card", {
    position,
    total,
    name: [admin.firstName, admin.lastName].filter(Boolean).join(" ") || admin.username || "—",
    username: admin.username ? `@${admin.username}` : "—",
    id: admin.id.toString(),
  });
}
