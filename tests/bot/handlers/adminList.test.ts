import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAdminListEntryHandler, createAdminListCallbackHandler } from "../../../src/bot/handlers/adminList";
import { buildAdminListInlineKeyboard, buildAdminDeleteConfirmKeyboard } from "../../../src/bot/keyboards/adminListInline";
import { formatAdminCard } from "../../../src/bot/formatAdminCard";

const SUPER_ADMIN_ID = 1n;

const superRow = { id: 1n, firstName: "Super", username: "boss", addedById: null, createdAt: new Date() };
const rowA = { id: 100n, firstName: "Ali", username: "ali", addedById: 1n, createdAt: new Date() };
const rowB = { id: 200n, firstName: "Vali", username: null, addedById: 1n, createdAt: new Date() };

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

describe("createAdminListEntryHandler", () => {
  it("does nothing for a non-super-admin caller", async () => {
    const userRepository = { listAll: vi.fn(), remove: vi.fn() } as any;
    const handler = createAdminListEntryHandler(userRepository, SUPER_ADMIN_ID);
    const ctx = createCtx({ from: { id: 999 } });
    await handler(ctx);
    expect(ctx.reply).not.toHaveBeenCalled();
    expect(userRepository.listAll).not.toHaveBeenCalled();
  });

  it("shows the empty message when there are no other admins", async () => {
    const userRepository = { listAll: vi.fn().mockResolvedValue([superRow]), remove: vi.fn() } as any;
    const handler = createAdminListEntryHandler(userRepository, SUPER_ADMIN_ID);
    const ctx = createCtx();
    await handler(ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(2);
    expect(ctx.reply.mock.calls[1][0]).toBe("Hozircha boshqa adminlar yo'q.");
  });

  it("shows the reply-keyboard message and the first card, excluding the super admin's own row", async () => {
    const userRepository = { listAll: vi.fn().mockResolvedValue([superRow, rowA, rowB]), remove: vi.fn() } as any;
    const handler = createAdminListEntryHandler(userRepository, SUPER_ADMIN_ID);
    const ctx = createCtx();
    await handler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(2);
    const [firstText, firstOptions] = ctx.reply.mock.calls[0];
    expect(firstText).toBe("👥 Adminlar");
    const keyboardTexts = firstOptions.reply_markup.keyboard.flat().map((b: any) => b.text);
    expect(keyboardTexts).toEqual(["➕ Admin qo'shish", "🔙 Orqaga"]);

    const [cardText, cardOptions] = ctx.reply.mock.calls[1];
    expect(cardText).toBe(formatAdminCard(rowA, 1, 2));
    expect(cardOptions.reply_markup.inline_keyboard).toEqual(
      buildAdminListInlineKeyboard(rowA.id, 0, 2).inline_keyboard
    );
  });
});

describe("createAdminListCallbackHandler", () => {
  let userRepository: { listAll: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    userRepository = { listAll: vi.fn(), remove: vi.fn() };
  });

  it("does nothing but ack for a non-super-admin caller", async () => {
    const handler = createAdminListCallbackHandler(userRepository as any, SUPER_ADMIN_ID);
    const ctx = createCtx({ from: { id: 999 }, callbackQuery: { data: "adminList:page:0" } });
    await handler(ctx);
    expect(ctx.answerCallbackQuery).toHaveBeenCalledTimes(1);
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith();
    expect(ctx.editMessageText).not.toHaveBeenCalled();
    expect(userRepository.listAll).not.toHaveBeenCalled();
  });

  it("page action navigates to the requested page", async () => {
    userRepository.listAll.mockResolvedValue([superRow, rowA, rowB]);
    const handler = createAdminListCallbackHandler(userRepository as any, SUPER_ADMIN_ID);
    const ctx = createCtx({ callbackQuery: { data: "adminList:page:1" } });
    await handler(ctx);

    expect(ctx.editMessageText).toHaveBeenCalledTimes(1);
    const [text, options] = ctx.editMessageText.mock.calls[0];
    expect(text).toBe(formatAdminCard(rowB, 2, 2));
    expect(options.reply_markup.inline_keyboard).toEqual(buildAdminListInlineKeyboard(rowB.id, 1, 2).inline_keyboard);
    expect(ctx.answerCallbackQuery).toHaveBeenCalledTimes(1);
  });

  it("askDelete action shows the confirm step", async () => {
    userRepository.listAll.mockResolvedValue([superRow, rowA, rowB]);
    const handler = createAdminListCallbackHandler(userRepository as any, SUPER_ADMIN_ID);
    const ctx = createCtx({ callbackQuery: { data: "adminList:askDelete:100:0" } });
    await handler(ctx);

    expect(ctx.editMessageText).toHaveBeenCalledTimes(1);
    const [text, options] = ctx.editMessageText.mock.calls[0];
    expect(text).toBe("Rostdan ham Ali (ID: 100) ni o'chirmoqchimisiz?");
    expect(options.reply_markup.inline_keyboard).toEqual(buildAdminDeleteConfirmKeyboard(100n, 0).inline_keyboard);
    expect(userRepository.remove).not.toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalledTimes(1);
  });

  it("askDelete falls back to re-rendering the current page when the target is already gone", async () => {
    userRepository.listAll.mockResolvedValue([superRow, rowB]);
    const handler = createAdminListCallbackHandler(userRepository as any, SUPER_ADMIN_ID);
    const ctx = createCtx({ callbackQuery: { data: "adminList:askDelete:100:0" } });
    await handler(ctx);

    expect(ctx.editMessageText).toHaveBeenCalledTimes(1);
    const [text] = ctx.editMessageText.mock.calls[0];
    expect(text).toBe(formatAdminCard(rowB, 1, 1));
    expect(ctx.answerCallbackQuery).toHaveBeenCalledTimes(1);
  });

  it("does not throw and still acks on malformed (non-numeric) callback data", async () => {
    userRepository.listAll.mockResolvedValue([superRow, rowA, rowB]);
    const handler = createAdminListCallbackHandler(userRepository as any, SUPER_ADMIN_ID);
    const ctx = createCtx({ callbackQuery: { data: "adminList:askDelete:not-a-number:0" } });

    await expect(handler(ctx)).resolves.toBeUndefined();

    expect(ctx.editMessageText).not.toHaveBeenCalled();
    expect(userRepository.remove).not.toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalledTimes(1);
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith();
  });

  it("confirmDelete removes the target and re-renders the remaining list", async () => {
    userRepository.listAll.mockResolvedValue([superRow, rowB]);
    const handler = createAdminListCallbackHandler(userRepository as any, SUPER_ADMIN_ID);
    const ctx = createCtx({ callbackQuery: { data: "adminList:confirmDelete:100:0" } });
    await handler(ctx);

    expect(userRepository.remove).toHaveBeenCalledWith(100n);
    expect(ctx.editMessageText).toHaveBeenCalledTimes(1);
    const [text, options] = ctx.editMessageText.mock.calls[0];
    expect(text).toBe(formatAdminCard(rowB, 1, 1));
    expect(options.reply_markup.inline_keyboard).toEqual(buildAdminListInlineKeyboard(rowB.id, 0, 1).inline_keyboard);
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith("Admin o'chirildi.");
  });

  it("confirmDelete on the last remaining admin shows the empty-list message", async () => {
    userRepository.listAll.mockResolvedValue([superRow]);
    const handler = createAdminListCallbackHandler(userRepository as any, SUPER_ADMIN_ID);
    const ctx = createCtx({ callbackQuery: { data: "adminList:confirmDelete:200:0" } });
    await handler(ctx);

    expect(userRepository.remove).toHaveBeenCalledWith(200n);
    expect(ctx.editMessageText).toHaveBeenCalledWith("Hozircha boshqa adminlar yo'q.");
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith("Admin o'chirildi.");
  });

  it("cancelDelete re-renders the same page without deleting", async () => {
    userRepository.listAll.mockResolvedValue([superRow, rowA, rowB]);
    const handler = createAdminListCallbackHandler(userRepository as any, SUPER_ADMIN_ID);
    const ctx = createCtx({ callbackQuery: { data: "adminList:cancelDelete:0" } });
    await handler(ctx);

    expect(userRepository.remove).not.toHaveBeenCalled();
    expect(ctx.editMessageText).toHaveBeenCalledTimes(1);
    const [text, options] = ctx.editMessageText.mock.calls[0];
    expect(text).toBe(formatAdminCard(rowA, 1, 2));
    expect(options.reply_markup.inline_keyboard).toEqual(buildAdminListInlineKeyboard(rowA.id, 0, 2).inline_keyboard);
    expect(ctx.answerCallbackQuery).toHaveBeenCalledTimes(1);
  });
});
