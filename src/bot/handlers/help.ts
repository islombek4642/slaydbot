import { InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import { t } from "../../i18n/t";

export function createHelpHandler(superAdminId: bigint) {
  return async (ctx: Context): Promise<void> => {
    const keyboard = new InlineKeyboard().url(t("help.contactAdmin"), `tg://user?id=${superAdminId}`);
    await ctx.reply(t("help.text"), { reply_markup: keyboard });
  };
}
