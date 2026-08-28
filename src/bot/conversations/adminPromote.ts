import type { Conversation } from "@grammyjs/conversations";
import type { MyContext } from "../context";
import { t } from "../../i18n/t";
import { parseTelegramId } from "./parsers";
import type { UserRepository } from "../../db/repositories/userRepository";

export function createAdminPromoteConversation(userRepository: UserRepository) {
  return async function adminPromote(conversation: Conversation<MyContext>, ctx: MyContext): Promise<void> {
    await ctx.reply(t("admin.promote.askId"));
    const idCtx = await conversation.waitFor("message:text");
    let targetId: bigint;
    try {
      targetId = parseTelegramId(idCtx.message.text);
    } catch (error) {
      await idCtx.reply(error instanceof Error ? error.message : String(error));
      return;
    }
    await conversation.external(() => userRepository.promote(targetId));
    await idCtx.reply(t("admin.promote.success"));
  };
}
