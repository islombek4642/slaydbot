import { describe, it, expect, vi } from "vitest";
import { createModelEntryHandler, createModelCallbackHandler } from "../../../src/bot/handlers/model";
import { buildModelInlineKeyboard } from "../../../src/bot/keyboards/modelInline";

const SUPER_ADMIN_ID = 1n;

function createCtx(overrides: Record<string, unknown> = {}) {
  return {
    from: { id: 1 },
    reply: vi.fn(),
    editMessageText: vi.fn(),
    answerCallbackQuery: vi.fn(),
    callbackQuery: { data: "" },
    ...overrides,
  } as any;
}

function createMockSettingRepository() {
  return { get: vi.fn(), set: vi.fn() };
}

function createMockPresentationService() {
  return { setModel: vi.fn() };
}

describe("createModelEntryHandler", () => {
  it("does nothing for a non-super-admin caller", async () => {
    const settingRepository = createMockSettingRepository();
    const handler = createModelEntryHandler(settingRepository as any, SUPER_ADMIN_ID);
    const ctx = createCtx({ from: { id: 999 } });
    await handler(ctx);
    expect(ctx.reply).not.toHaveBeenCalled();
    expect(settingRepository.get).not.toHaveBeenCalled();
  });

  it("shows the default model (Sonnet 5) when nothing is stored yet", async () => {
    const settingRepository = createMockSettingRepository();
    settingRepository.get.mockResolvedValue(null);
    const handler = createModelEntryHandler(settingRepository as any, SUPER_ADMIN_ID);
    const ctx = createCtx();
    await handler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const [text, options] = ctx.reply.mock.calls[0];
    expect(text).toBe("Joriy model: Sonnet 5\n\nYangi modelni tanlang:");
    expect(options.reply_markup.inline_keyboard).toEqual(
      buildModelInlineKeyboard("claude-sonnet-5").inline_keyboard
    );
  });

  it("shows the stored model when one has been chosen", async () => {
    const settingRepository = createMockSettingRepository();
    settingRepository.get.mockResolvedValue("claude-opus-5");
    const handler = createModelEntryHandler(settingRepository as any, SUPER_ADMIN_ID);
    const ctx = createCtx();
    await handler(ctx);

    const [text] = ctx.reply.mock.calls[0];
    expect(text).toBe("Joriy model: Opus 5\n\nYangi modelni tanlang:");
  });
});

describe("createModelCallbackHandler", () => {
  it("does nothing but ack for a non-super-admin caller", async () => {
    const settingRepository = createMockSettingRepository();
    const presentationService = createMockPresentationService();
    const handler = createModelCallbackHandler(settingRepository as any, presentationService as any, SUPER_ADMIN_ID);
    const ctx = createCtx({ from: { id: 999 }, callbackQuery: { data: "model:claude-opus-5" } });
    await handler(ctx);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith();
    expect(settingRepository.set).not.toHaveBeenCalled();
    expect(presentationService.setModel).not.toHaveBeenCalled();
  });

  it("does nothing but ack for an unknown model id", async () => {
    const settingRepository = createMockSettingRepository();
    const presentationService = createMockPresentationService();
    const handler = createModelCallbackHandler(settingRepository as any, presentationService as any, SUPER_ADMIN_ID);
    const ctx = createCtx({ callbackQuery: { data: "model:not-a-real-model" } });
    await handler(ctx);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith();
    expect(settingRepository.set).not.toHaveBeenCalled();
    expect(presentationService.setModel).not.toHaveBeenCalled();
  });

  it("persists the chosen model, applies it live, and re-renders the keyboard", async () => {
    const settingRepository = createMockSettingRepository();
    const presentationService = createMockPresentationService();
    const handler = createModelCallbackHandler(settingRepository as any, presentationService as any, SUPER_ADMIN_ID);
    const ctx = createCtx({ callbackQuery: { data: "model:claude-opus-5" } });
    await handler(ctx);

    expect(settingRepository.set).toHaveBeenCalledWith("aiModel", "claude-opus-5");
    expect(presentationService.setModel).toHaveBeenCalledWith("claude-opus-5");

    expect(ctx.editMessageText).toHaveBeenCalledTimes(1);
    const [text, options] = ctx.editMessageText.mock.calls[0];
    expect(text).toBe("Joriy model: Opus 5\n\nYangi modelni tanlang:");
    expect(options.reply_markup.inline_keyboard).toEqual(
      buildModelInlineKeyboard("claude-opus-5").inline_keyboard
    );
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith("Model o'zgartirildi: Opus 5");
  });
});
