import { InlineKeyboard } from "grammy";
import { AI_MODELS, type AiModelId } from "../../config/constants";

export function buildModelInlineKeyboard(selectedId: AiModelId): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const model of AI_MODELS) {
    const label = model.id === selectedId ? `✅ ${model.label}` : model.label;
    keyboard.text(label, `model:${model.id}`).row();
  }
  return keyboard;
}
