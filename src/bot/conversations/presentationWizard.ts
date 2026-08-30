import { InputFile, type Context, type Keyboard } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import type { MyContext } from "../context";
import { t } from "../../i18n/t";
import {
  buildSlideCountKeyboard,
  buildLanguageKeyboard,
  buildThemeKeyboard,
  buildConfirmKeyboard,
  buildCancelKeyboard,
} from "../keyboards/wizardKeyboards";
import { buildMainMenuKeyboard } from "../keyboards/mainMenu";
import {
  parseSlideCountText,
  parseLanguageText,
  parseThemeText,
  formatSlideCount,
  formatLanguage,
  formatTheme,
  isCommandText,
} from "./parsers";
import { isSuperAdmin } from "../superAdmin";
import type { PresentationService } from "../../services/presentationService";

type Selection<T> = { cancelled: true } | { cancelled: false; value: T };

async function waitForSelection<T>(
  conversation: Conversation<MyContext>,
  ctx: Context,
  prompt: string,
  keyboard: Keyboard,
  parse: (text: string) => T | undefined
): Promise<Selection<T>> {
  for (;;) {
    const msgCtx = await conversation.waitFor("message:text");
    const text = msgCtx.message.text;
    if (text === t("wizard.cancel") || isCommandText(text)) {
      return { cancelled: true };
    }
    const value = parse(text);
    if (value !== undefined) {
      return { cancelled: false, value };
    }
    await ctx.reply(prompt, { reply_markup: keyboard });
  }
}

export function createPresentationWizard(presentationService: PresentationService, superAdminId: bigint) {
  return async function presentationWizard(conversation: Conversation<MyContext>, ctx: Context): Promise<void> {
    const mainMenuFor = (wizardCtx: Context): Keyboard =>
      buildMainMenuKeyboard(isSuperAdmin(BigInt(wizardCtx.from!.id), superAdminId));

    await ctx.reply(t("wizard.askTopic"), { reply_markup: buildCancelKeyboard() });
    const topicCtx = await conversation.waitFor("message:text");
    if (topicCtx.message.text === t("wizard.cancel") || isCommandText(topicCtx.message.text)) {
      await topicCtx.reply(t("wizard.cancelled"), { reply_markup: mainMenuFor(topicCtx) });
      return;
    }
    const topic = topicCtx.message.text;

    await ctx.reply(t("wizard.askSlideCount"), { reply_markup: buildSlideCountKeyboard() });
    const slideCountSelection = await waitForSelection(
      conversation,
      ctx,
      t("wizard.askSlideCount"),
      buildSlideCountKeyboard(),
      parseSlideCountText
    );
    if (slideCountSelection.cancelled) {
      await ctx.reply(t("wizard.cancelled"), { reply_markup: mainMenuFor(ctx) });
      return;
    }
    const slideCount = slideCountSelection.value;

    await ctx.reply(t("wizard.askLanguage"), { reply_markup: buildLanguageKeyboard() });
    const languageSelection = await waitForSelection(
      conversation,
      ctx,
      t("wizard.askLanguage"),
      buildLanguageKeyboard(),
      parseLanguageText
    );
    if (languageSelection.cancelled) {
      await ctx.reply(t("wizard.cancelled"), { reply_markup: mainMenuFor(ctx) });
      return;
    }
    const language = languageSelection.value;

    await ctx.reply(t("wizard.askTheme"), { reply_markup: buildThemeKeyboard() });
    const themeSelection = await waitForSelection(
      conversation,
      ctx,
      t("wizard.askTheme"),
      buildThemeKeyboard(),
      parseThemeText
    );
    if (themeSelection.cancelled) {
      await ctx.reply(t("wizard.cancelled"), { reply_markup: mainMenuFor(ctx) });
      return;
    }
    const themeName = themeSelection.value;

    const summary = t("wizard.confirm.summary", {
      topic,
      slideCount: formatSlideCount(slideCount),
      language: formatLanguage(language),
      theme: formatTheme(themeName),
    });
    await ctx.reply(summary, { reply_markup: buildConfirmKeyboard() });
    const confirmSelection = await waitForSelection(
      conversation,
      ctx,
      summary,
      buildConfirmKeyboard(),
      (text) => (text === t("wizard.confirm.yes") ? true : undefined)
    );
    if (confirmSelection.cancelled) {
      await ctx.reply(t("wizard.cancelled"), { reply_markup: mainMenuFor(ctx) });
      return;
    }

    await ctx.reply(t("wizard.generating"));

    const userId = BigInt(ctx.from!.id);
    const result = await conversation.external(() =>
      presentationService.generate({ userId, topic, slideCount, language, themeName })
    );

    if (result.success && result.buffer) {
      const safeFilename = `${topic.replace(/[\r\n]+/g, " ").trim().slice(0, 60) || "taqdimot"}.pptx`;
      await ctx.replyWithDocument(new InputFile(result.buffer, safeFilename), {
        caption: t("wizard.success"),
        reply_markup: mainMenuFor(ctx),
      });
    } else {
      await ctx.reply(t("wizard.error", { requestId: result.requestId.slice(0, 8) }), {
        reply_markup: mainMenuFor(ctx),
      });
    }
  };
}
