import { Bot } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import type { MyContext } from "./context";
import { t } from "../i18n/t";
import { createAccessControlMiddleware } from "./middlewares/accessControl";
import { createStartHandler } from "./handlers/start";
import { createHelpHandler } from "./handlers/help";
import { createAdminListEntryHandler, createAdminListCallbackHandler } from "./handlers/adminList";
import { buildAdminMenuKeyboard } from "./keyboards/adminMenu";
import { buildMainMenuKeyboard } from "./keyboards/mainMenu";
import { createPresentationWizard } from "./conversations/presentationWizard";
import { createAdminAddUserConversation } from "./conversations/adminAddUser";
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
  bot.use(
    createConversation(createPresentationWizard(deps.presentationService, deps.superAdminId), "presentationWizard")
  );
  bot.use(createConversation(createAdminAddUserConversation(deps.userRepository), "adminAddUser"));

  const accessControl = createAccessControlMiddleware(deps.userRepository);
  bot.use(accessControl);

  bot.command("start", createStartHandler(deps.superAdminId));
  bot.command("help", createHelpHandler(deps.superAdminId));

  bot.hears(t("menu.createPresentation"), async (ctx) => {
    await ctx.conversation.enter("presentationWizard");
  });

  bot.hears(t("menu.adminPanel"), async (ctx) => {
    if (!isSuperAdmin(BigInt(ctx.from!.id), deps.superAdminId)) {
      return;
    }
    await ctx.reply(t("menu.adminPanel"), { reply_markup: buildAdminMenuKeyboard() });
  });

  bot.hears(t("menu.back"), async (ctx) => {
    const superAdmin = isSuperAdmin(BigInt(ctx.from!.id), deps.superAdminId);
    await ctx.reply(t("start.welcome"), { reply_markup: buildMainMenuKeyboard(superAdmin) });
  });

  bot.hears(t("admin.addUser"), async (ctx) => {
    if (!isSuperAdmin(BigInt(ctx.from!.id), deps.superAdminId)) {
      return;
    }
    await ctx.conversation.enter("adminAddUser");
  });

  bot.hears(t("admin.adminsButton"), createAdminListEntryHandler(deps.userRepository, deps.superAdminId));

  bot.callbackQuery(/^adminList:/, createAdminListCallbackHandler(deps.userRepository, deps.superAdminId));

  return bot;
}
