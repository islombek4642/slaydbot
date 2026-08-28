import type { Context } from "grammy";
import type { UserRepository } from "../../db/repositories/userRepository";
import { t } from "../../i18n/t";

export function createListUsersHandler(userRepository: UserRepository) {
  return async (ctx: Context): Promise<void> => {
    const users = await userRepository.listAll();
    if (users.length === 0) {
      await ctx.reply(t("admin.listUsers.empty"));
      return;
    }
    const lines = users.map((user, index) =>
      t("admin.listUsers.item", {
        index: index + 1,
        name: user.firstName ?? user.username ?? "—",
        id: user.id.toString(),
      })
    );
    await ctx.reply(lines.join("\n"));
  };
}
