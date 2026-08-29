import type { Context } from "grammy";
import type { UserRepository } from "../../db/repositories/userRepository";
import { t } from "../../i18n/t";
import { formatUserList } from "../formatUserList";

export function createListUsersHandler(userRepository: UserRepository) {
  return async (ctx: Context): Promise<void> => {
    const users = await userRepository.listAll();
    if (users.length === 0) {
      await ctx.reply(t("admin.listUsers.empty"));
      return;
    }
    await ctx.reply(formatUserList(users));
  };
}
