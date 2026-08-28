import { describe, it, expect, vi } from "vitest";
import { createAccessControlMiddleware } from "../../../src/bot/middlewares/accessControl";

function createMockCtx(userId: number | undefined) {
  return {
    from: userId === undefined ? undefined : { id: userId },
    reply: vi.fn(),
  } as any;
}

describe("createAccessControlMiddleware", () => {
  it("calls next() when the user is allowed", async () => {
    const userRepository = { isAllowed: vi.fn().mockResolvedValue(true) } as any;
    const middleware = createAccessControlMiddleware(userRepository);
    const ctx = createMockCtx(1);
    const next = vi.fn();
    await middleware(ctx, next);
    expect(next).toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it("replies with access denied and skips next() when the user is not allowed", async () => {
    const userRepository = { isAllowed: vi.fn().mockResolvedValue(false) } as any;
    const middleware = createAccessControlMiddleware(userRepository);
    const ctx = createMockCtx(2);
    const next = vi.fn();
    await middleware(ctx, next);
    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith("Kirish cheklangan. Administrator bilan bog'laning.");
  });

  it("does nothing when the update has no sender id", async () => {
    const userRepository = { isAllowed: vi.fn() } as any;
    const middleware = createAccessControlMiddleware(userRepository);
    const ctx = createMockCtx(undefined);
    const next = vi.fn();
    await middleware(ctx, next);
    expect(userRepository.isAllowed).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
