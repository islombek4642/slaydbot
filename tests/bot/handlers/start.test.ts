import { describe, it, expect, vi } from "vitest";
import { createStartHandler } from "../../../src/bot/handlers/start";

const SUPER_ADMIN_ID = 1n;

function createUserRepository() {
  return { updateProfile: vi.fn() } as any;
}

describe("createStartHandler", () => {
  it("replies with the welcome message and a menu including the admin panel for the super admin", async () => {
    const userRepository = createUserRepository();
    const handler = createStartHandler(userRepository, SUPER_ADMIN_ID);
    const ctx = { from: { id: 1, first_name: "Boss", username: "boss" }, reply: vi.fn() } as any;
    await handler(ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const [text, options] = ctx.reply.mock.calls[0];
    expect(text).toBe("Xush kelibsiz! Quyidagi menyudan foydalaning.");
    const texts = options.reply_markup.keyboard.flat().map((b: any) => b.text);
    expect(texts).toContain("⚙️ Admin panel");
  });

  it("omits the admin panel button for non-super-admins", async () => {
    const userRepository = createUserRepository();
    const handler = createStartHandler(userRepository, SUPER_ADMIN_ID);
    const ctx = { from: { id: 2, first_name: "Ali", username: "ali" }, reply: vi.fn() } as any;
    await handler(ctx);
    const [, options] = ctx.reply.mock.calls[0];
    const texts = options.reply_markup.keyboard.flat().map((b: any) => b.text);
    expect(texts).not.toContain("⚙️ Admin panel");
  });

  it("backfills the caller's username and first name from their Telegram profile", async () => {
    const userRepository = createUserRepository();
    const handler = createStartHandler(userRepository, SUPER_ADMIN_ID);
    const ctx = { from: { id: 2, first_name: "Ali", username: "ali" }, reply: vi.fn() } as any;
    await handler(ctx);
    expect(userRepository.updateProfile).toHaveBeenCalledWith(2n, { username: "ali", firstName: "Ali" });
  });
});
