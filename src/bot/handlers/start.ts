import type { Context } from "grammy";
import { buildMainMenuKeyboard } from "../keyboards/mainMenu";
import { isSuperAdmin } from "../superAdmin";
import { t } from "../../i18n/t";

export function createStartHandler(superAdminId: bigint) {
  return async (ctx: Context): Promise<void> => {
    const userId = ctx.from?.id;
    if (userId === undefined) {
      return;
    }
    const superAdmin = isSuperAdmin(BigInt(userId), superAdminId);
    await ctx.reply(t("start.welcome"), { reply_markup: buildMainMenuKeyboard(superAdmin) });
  };
}
