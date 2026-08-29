import { describe, it, expect, vi } from "vitest";
import { createAccessControlMiddleware } from "../../../src/bot/middlewares/accessControl";

function createMockCtx(userId: number | undefined, profile?: { username?: string; first_name?: string }) {
  return {
    from: userId === undefined ? undefined : { id: userId, ...profile },
    reply: vi.fn(),
  } as any;
}

describe("createAccessControlMiddleware", () => {
  it("calls next() when the user is allowed", async () => {
    const userRepository = {
      isAllowed: vi.fn().mockResolvedValue(true),
      updateProfile: vi.fn(),
    } as any;
    const middleware = createAccessControlMiddleware(userRepository);
    const ctx = createMockCtx(1, { username: "ali", first_name: "Ali" });
    const next = vi.fn();
    await middleware(ctx, next);
    expect(next).toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
    expect(userRepository.updateProfile).toHaveBeenCalledWith(1n, { username: "ali", firstName: "Ali" });
  });

  it("replies with access denied and skips next() when the user is not allowed", async () => {
    const userRepository = {
      isAllowed: vi.fn().mockResolvedValue(false),
      updateProfile: vi.fn(),
    } as any;
    const middleware = createAccessControlMiddleware(userRepository);
    const ctx = createMockCtx(2);
    const next = vi.fn();
    await middleware(ctx, next);
    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith("Kirish cheklangan. Administrator bilan bog'laning.");
    expect(userRepository.updateProfile).not.toHaveBeenCalled();
  });

  it("does nothing when the update has no sender id", async () => {
    const userRepository = { isAllowed: vi.fn(), updateProfile: vi.fn() } as any;
    const middleware = createAccessControlMiddleware(userRepository);
    const ctx = createMockCtx(undefined);
    const next = vi.fn();
    await middleware(ctx, next);
    expect(userRepository.isAllowed).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(userRepository.updateProfile).not.toHaveBeenCalled();
  });
});
