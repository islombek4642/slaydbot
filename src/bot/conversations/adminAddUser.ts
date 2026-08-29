import type { Context } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import type { MyContext } from "../context";
import { t } from "../../i18n/t";
import { parseTelegramId } from "./parsers";
import type { UserProfile, UserRepository } from "../../db/repositories/userRepository";

export function createAdminAddUserConversation(userRepository: UserRepository) {
  return async function adminAddUser(conversation: Conversation<MyContext>, ctx: Context): Promise<void> {
    await ctx.reply(t("admin.addUser.askId"));
    const idCtx = await conversation.waitFor(["message:text", "message:forward_origin"]);

    let targetId: bigint;
    let profile: UserProfile = {};

    if (idCtx.has("message:forward_origin")) {
      const origin = idCtx.message.forward_origin;
      if (origin.type !== "user") {
        await idCtx.reply(t("admin.addUser.forwardUnavailable"));
        return;
      }
      targetId = BigInt(origin.sender_user.id);
      profile = {
        username: origin.sender_user.username,
        firstName: origin.sender_user.first_name,
      };
    } else if (idCtx.has("message:text")) {
      try {
        targetId = parseTelegramId(idCtx.message.text);
      } catch (error) {
        await idCtx.reply(error instanceof Error ? error.message : String(error));
        return;
      }
    } else {
      await idCtx.reply(t("admin.addUser.forwardUnavailable"));
      return;
    }

    const addedById = BigInt(ctx.from!.id);
    await conversation.external(() => userRepository.add(targetId, addedById, profile));
    await idCtx.reply(t("admin.addUser.success"));
  };
}
