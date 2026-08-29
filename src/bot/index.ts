import { Bot } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import type { MyContext } from "./context";
import { t } from "../i18n/t";
import { createAccessControlMiddleware } from "./middlewares/accessControl";
import { createStartHandler } from "./handlers/start";
import { helpHandler } from "./handlers/help";
import { createListUsersHandler } from "./handlers/listUsers";
import { buildAdminMenuKeyboard } from "./keyboards/adminMenu";
import { buildMainMenuKeyboard } from "./keyboards/mainMenu";
import { createPresentationWizard } from "./conversations/presentationWizard";
import { createAdminAddUserConversation } from "./conversations/adminAddUser";
import { createAdminRemoveUserConversation } from "./conversations/adminRemoveUser";
import { createAdminPromoteConversation } from "./conversations/adminPromote";
import { isSuperAdmin } from "./superAdmin";
import type { UserRepository } from "../db/repositories/userRepository";
import type { PresentationService } from "../services/presentationService";

export interface BotDependencies {
  botToken: string;
  superAdminId: bigint;
  userRepository: UserRepository;
  presentationService: PresentationService;
}

export function createBot(deps: BotDependencies): Bot<MyContext> {
  const bot = new Bot<MyContext>(deps.botToken);

  // @grammyjs/conversations v2 manages its own state internally (in-memory by
  // default); it does not require grammY's core `session()` middleware.
  bot.use(conversations());
  bot.use(createConversation(createPresentationWizard(deps.presentationService), "presentationWizard"));
  bot.use(createConversation(createAdminAddUserConversation(deps.userRepository), "adminAddUser"));
  bot.use(createConversation(createAdminRemoveUserConversation(deps.userRepository), "adminRemoveUser"));
  bot.use(createConversation(createAdminPromoteConversation(deps.userRepository), "adminPromote"));

  const accessControl = createAccessControlMiddleware(deps.userRepository);
  bot.use(accessControl);

  bot.command("start", createStartHandler(deps.userRepository));
  bot.command("help", helpHandler);

  bot.hears(t("menu.createPresentation"), async (ctx) => {
    await ctx.conversation.enter("presentationWizard");
  });

  bot.hears(t("menu.adminPanel"), async (ctx) => {
    const superAdmin = isSuperAdmin(BigInt(ctx.from!.id), deps.superAdminId);
    await ctx.reply(t("menu.adminPanel"), { reply_markup: buildAdminMenuKeyboard(superAdmin) });
  });

  bot.hears(t("menu.back"), async (ctx) => {
    const admin = await deps.userRepository.isAdmin(BigInt(ctx.from!.id));
    await ctx.reply(t("start.welcome"), { reply_markup: buildMainMenuKeyboard(admin) });
  });

  bot.hears(t("admin.addUser"), async (ctx) => {
    await ctx.conversation.enter("adminAddUser");
  });

  bot.hears(t("admin.removeUser"), async (ctx) => {
    await ctx.conversation.enter("adminRemoveUser");
  });

  bot.hears(t("admin.listUsers"), createListUsersHandler(deps.userRepository));

  bot.hears(t("admin.promote"), async (ctx) => {
    if (!isSuperAdmin(BigInt(ctx.from!.id), deps.superAdminId)) {
      return;
    }
    await ctx.conversation.enter("adminPromote");
  });

  return bot;
}
