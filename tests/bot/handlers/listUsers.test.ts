import { describe, it, expect, vi } from "vitest";
import { createListUsersHandler } from "../../../src/bot/handlers/listUsers";

describe("createListUsersHandler", () => {
  it("replies with the empty message when there are no users", async () => {
    const userRepository = { listAll: vi.fn().mockResolvedValue([]) } as any;
    const handler = createListUsersHandler(userRepository);
    const ctx = { reply: vi.fn() } as any;
    await handler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith("Ro'yxat bo'sh.");
  });

  it("formats each user as a numbered line", async () => {
    const userRepository = {
      listAll: vi.fn().mockResolvedValue([
        { id: 111n, firstName: "Ali", username: null },
        { id: 222n, firstName: null, username: "vali" },
      ]),
    } as any;
    const handler = createListUsersHandler(userRepository);
    const ctx = { reply: vi.fn() } as any;
    await handler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith("1. Ali — ID: 111\n2. vali — ID: 222");
  });
});
