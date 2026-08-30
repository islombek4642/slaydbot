import type { Context } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import type { MyContext } from "../context";
import { t } from "../../i18n/t";
import { parseTelegramId, isCommandText } from "./parsers";
import { buildCancelKeyboard } from "../keyboards/wizardKeyboards";
import { buildAdminListMenuKeyboard } from "../keyboards/adminListMenu";
import type { UserProfile, UserRepository } from "../../db/repositories/userRepository";

export function createAdminAddUserConversation(userRepository: UserRepository) {
  return async function adminAddUser(conversation: Conversation<MyContext>, ctx: Context): Promise<void> {
    await ctx.reply(t("admin.addUser.askId"), { reply_markup: buildCancelKeyboard() });

    for (;;) {
      const idCtx = await conversation.waitFor(["message:text", "message:forward_origin"]);

      if (
        idCtx.has("message:text") &&
        (idCtx.message.text === t("wizard.cancel") || isCommandText(idCtx.message.text))
      ) {
        await idCtx.reply(t("wizard.cancelled"), { reply_markup: buildAdminListMenuKeyboard() });
        return;
      }

      let targetId: bigint;
      let profile: UserProfile = {};

      if (idCtx.has("message:forward_origin")) {
        const origin = idCtx.message.forward_origin;
        if (origin.type !== "user") {
          await idCtx.reply(t("admin.addUser.forwardUnavailable"), { reply_markup: buildCancelKeyboard() });
          continue;
        }
        targetId = BigInt(origin.sender_user.id);
        profile = {
          username: origin.sender_user.username,
          firstName: origin.sender_user.first_name,
          lastName: origin.sender_user.last_name,
        };
      } else if (idCtx.has("message:text")) {
        try {
          targetId = parseTelegramId(idCtx.message.text);
        } catch (error) {
          await idCtx.reply(error instanceof Error ? error.message : String(error), {
            reply_markup: buildCancelKeyboard(),
          });
          continue;
        }
      } else {
        await idCtx.reply(t("admin.addUser.forwardUnavailable"), { reply_markup: buildCancelKeyboard() });
        continue;
      }

      const addedById = BigInt(ctx.from!.id);
      await conversation.external(() => userRepository.add(targetId, addedById, profile));
      await idCtx.reply(t("admin.addUser.success"), { reply_markup: buildAdminListMenuKeyboard() });
      return;
    }
  };
}
