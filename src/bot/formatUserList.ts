import type { UserRecord } from "../db/repositories/userRepository";
import { t } from "../i18n/t";

/**
 * Formats a list of users into a numbered string representation.
 * Returns an empty string if the list is empty.
 */
export function formatUserList(users: UserRecord[]): string {
  if (users.length === 0) {
    return "";
  }
  const lines = users.map((user, index) =>
    t("admin.listUsers.item", {
      index: index + 1,
      name: user.firstName ?? user.username ?? "—",
      id: user.id.toString(),
    })
  );
  return lines.join("\n");
}
