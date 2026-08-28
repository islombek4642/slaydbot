import type { Context } from "grammy";
import type { UserRepository } from "../../db/repositories/userRepository";
import { buildMainMenuKeyboard } from "../keyboards/mainMenu";
import { t } from "../../i18n/t";

export function createStartHandler(userRepository: UserRepository) {
  return async (ctx: Context): Promise<void> => {
    const userId = ctx.from?.id;
    if (userId === undefined) {
      return;
    }
    const isAdmin = await userRepository.isAdmin(BigInt(userId));
    await ctx.reply(t("start.welcome"), { reply_markup: buildMainMenuKeyboard(isAdmin) });
  };
}
