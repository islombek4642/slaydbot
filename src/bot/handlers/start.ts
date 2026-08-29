import type { Context } from "grammy";
import { buildMainMenuKeyboard } from "../keyboards/mainMenu";
import { isSuperAdmin } from "../superAdmin";
import { t } from "../../i18n/t";
import type { UserRepository } from "../../db/repositories/userRepository";

export function createStartHandler(userRepository: UserRepository, superAdminId: bigint) {
  return async (ctx: Context): Promise<void> => {
    const userId = ctx.from?.id;
    if (userId === undefined) {
      return;
    }
    await userRepository.updateProfile(BigInt(userId), {
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
    });
    const superAdmin = isSuperAdmin(BigInt(userId), superAdminId);
    await ctx.reply(t("start.welcome"), { reply_markup: buildMainMenuKeyboard(superAdmin) });
  };
}
