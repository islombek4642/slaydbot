import { describe, it, expect, vi } from "vitest";
import { createHelpHandler } from "../../../src/bot/handlers/help";

describe("createHelpHandler", () => {
  it("replies with the help text and an inline button linking to the super admin's chat", async () => {
    const superAdminId = 111111111n;
    const handler = createHelpHandler(superAdminId);
    const ctx = { reply: vi.fn() } as any;
    await handler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const [text, options] = ctx.reply.mock.calls[0];
    expect(text).toBe(
      'Bu bot AI yordamida taqdimot (.pptx) yaratadi. "🎨 Taqdimot yaratish" tugmasini bosing va ko\'rsatmalarga amal qiling.'
    );
    const buttons = options.reply_markup.inline_keyboard.flat();
    expect(buttons).toEqual([{ text: "👤 Admin", url: "tg://user?id=111111111" }]);
  });
});
