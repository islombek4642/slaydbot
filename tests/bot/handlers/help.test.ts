import { describe, it, expect, vi } from "vitest";
import { helpHandler } from "../../../src/bot/handlers/help";

describe("helpHandler", () => {
  it("replies with the help text", async () => {
    const ctx = { reply: vi.fn() } as any;
    await helpHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(
      'Bu bot AI yordamida taqdimot (.pptx) yaratadi. "🎨 Taqdimot yaratish" tugmasini bosing va ko\'rsatmalarga amal qiling.'
    );
  });
});
