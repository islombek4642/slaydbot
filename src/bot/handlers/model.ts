import type { Context } from "grammy";
import { isSuperAdmin } from "../superAdmin";
import { t } from "../../i18n/t";
import { buildModelInlineKeyboard } from "../keyboards/modelInline";
import { AI_MODELS, AI_MODEL_SETTING_KEY, DEFAULT_AI_MODEL, type AiModelId } from "../../config/constants";
import type { SettingRepository } from "../../db/repositories/settingRepository";
import type { PresentationService } from "../../services/presentationService";

function isKnownModelId(value: string): value is AiModelId {
  return AI_MODELS.some((model) => model.id === value);
}

function labelFor(id: AiModelId): string {
  return AI_MODELS.find((model) => model.id === id)!.label;
}

async function getSelectedModel(settingRepository: SettingRepository): Promise<AiModelId> {
  const stored = await settingRepository.get(AI_MODEL_SETTING_KEY);
  return stored !== null && isKnownModelId(stored) ? stored : DEFAULT_AI_MODEL;
}

export function createModelEntryHandler(settingRepository: SettingRepository, superAdminId: bigint) {
  return async (ctx: Context): Promise<void> => {
    const userId = ctx.from?.id;
    if (userId === undefined || !isSuperAdmin(BigInt(userId), superAdminId)) {
      return;
    }
    const selected = await getSelectedModel(settingRepository);
    await ctx.reply(t("admin.model.current", { model: labelFor(selected) }), {
      reply_markup: buildModelInlineKeyboard(selected),
    });
  };
}

export function createModelCallbackHandler(
  settingRepository: SettingRepository,
  presentationService: PresentationService,
  superAdminId: bigint
) {
  return async (ctx: Context): Promise<void> => {
    const userId = ctx.from?.id;
    if (userId === undefined || !isSuperAdmin(BigInt(userId), superAdminId)) {
      await ctx.answerCallbackQuery();
      return;
    }

    const data = ctx.callbackQuery?.data;
    const modelId = data?.split(":")[1];
    if (modelId === undefined || !isKnownModelId(modelId)) {
      await ctx.answerCallbackQuery();
      return;
    }

    await settingRepository.set(AI_MODEL_SETTING_KEY, modelId);
    presentationService.setModel(modelId);

    await ctx.editMessageText(t("admin.model.current", { model: labelFor(modelId) }), {
      reply_markup: buildModelInlineKeyboard(modelId),
    });
    await ctx.answerCallbackQuery(t("admin.model.updated", { model: labelFor(modelId) }));
  };
}
