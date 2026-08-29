import type { Conversation } from "@grammyjs/conversations";
import type { Context } from "grammy";
import type { MyContext } from "../context";
import { t } from "../../i18n/t";
import { parseTelegramId } from "./parsers";
import type { UserRepository } from "../../db/repositories/userRepository";

export function createAdminAddUserConversation(userRepository: UserRepository) {
  return async function adminAddUser(conversation: Conversation<MyContext>, ctx: Context): Promise<void> {
    await ctx.reply(t("admin.addUser.askId"));
    const idCtx = await conversation.waitFor("message:text");
    let targetId: bigint;
    try {
      targetId = parseTelegramId(idCtx.message.text);
    } catch (error) {
      await idCtx.reply(error instanceof Error ? error.message : String(error));
      return;
    }
    const addedById = BigInt(ctx.from!.id);
    await conversation.external(() => userRepository.add(targetId, addedById));
    await idCtx.reply(t("admin.addUser.success"));
  };
}
