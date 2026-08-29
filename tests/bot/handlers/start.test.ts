import { describe, it, expect, vi } from "vitest";
import { createStartHandler } from "../../../src/bot/handlers/start";

const SUPER_ADMIN_ID = 1n;

describe("createStartHandler", () => {
  it("replies with the welcome message and a menu including the admin panel for the super admin", async () => {
    const handler = createStartHandler(SUPER_ADMIN_ID);
    const ctx = { from: { id: 1 }, reply: vi.fn() } as any;
    await handler(ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const [text, options] = ctx.reply.mock.calls[0];
    expect(text).toBe("Xush kelibsiz! Quyidagi menyudan foydalaning.");
    const texts = options.reply_markup.keyboard.flat().map((b: any) => b.text);
    expect(texts).toContain("⚙️ Admin panel");
  });

  it("omits the admin panel button for non-super-admins", async () => {
    const handler = createStartHandler(SUPER_ADMIN_ID);
    const ctx = { from: { id: 2 }, reply: vi.fn() } as any;
    await handler(ctx);
    const [, options] = ctx.reply.mock.calls[0];
    const texts = options.reply_markup.keyboard.flat().map((b: any) => b.text);
    expect(texts).not.toContain("⚙️ Admin panel");
  });
});
