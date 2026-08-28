import { InputFile } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import type { MyContext } from "../context";
import { t } from "../../i18n/t";
import {
  buildSlideCountKeyboard,
  buildLanguageKeyboard,
  buildThemeKeyboard,
  buildCancelKeyboard,
} from "../keyboards/wizardKeyboards";
import { parseCallbackValue } from "./parsers";
import type { PresentationService } from "../../services/presentationService";
import type { ThemeName, PresentationLanguageCode } from "../../config/constants";

export function createPresentationWizard(presentationService: PresentationService) {
  return async function presentationWizard(conversation: Conversation<MyContext>, ctx: MyContext): Promise<void> {
    await ctx.reply(t("wizard.askTopic"), { reply_markup: buildCancelKeyboard() });
    const topicCtx = await conversation.waitFor(["message:text", "callback_query:data"]);
    if (topicCtx.has("callback_query:data")) {
      await topicCtx.answerCallbackQuery();
      await topicCtx.reply(t("wizard.cancelled"));
      return;
    }
    const topic = topicCtx.message.text;

    await ctx.reply(t("wizard.askSlideCount"), { reply_markup: buildSlideCountKeyboard() });
    const slideCountCtx = await conversation.waitFor("callback_query:data");
    await slideCountCtx.answerCallbackQuery();
    const slideCount = Number(parseCallbackValue(slideCountCtx.callbackQuery.data, "slideCount"));

    await ctx.reply(t("wizard.askLanguage"), { reply_markup: buildLanguageKeyboard() });
    const languageCtx = await conversation.waitFor("callback_query:data");
    await languageCtx.answerCallbackQuery();
    const language = parseCallbackValue(languageCtx.callbackQuery.data, "language") as PresentationLanguageCode;

    await ctx.reply(t("wizard.askTheme"), { reply_markup: buildThemeKeyboard() });
    const themeCtx = await conversation.waitFor("callback_query:data");
    await themeCtx.answerCallbackQuery();
    const themeName = parseCallbackValue(themeCtx.callbackQuery.data, "theme") as ThemeName;

    await ctx.reply(t("wizard.generating"));

    const userId = BigInt(ctx.from!.id);
    const result = await conversation.external(() =>
      presentationService.generate({ userId, topic, slideCount, language, themeName })
    );

    if (result.success && result.buffer) {
      await ctx.replyWithDocument(new InputFile(result.buffer, `${topic}.pptx`), {
        caption: t("wizard.success"),
      });
    } else {
      await ctx.reply(t("wizard.error"));
    }
  };
}
