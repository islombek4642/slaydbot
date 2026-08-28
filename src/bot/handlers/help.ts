import type { Context } from "grammy";
import { t } from "../../i18n/t";

export async function helpHandler(ctx: Context): Promise<void> {
  await ctx.reply(t("help.text"));
}
