import type { Context, NextFunction } from "grammy";
import type { UserRepository } from "../../db/repositories/userRepository";
import { t } from "../../i18n/t";

export function createAccessControlMiddleware(userRepository: UserRepository) {
  return async (ctx: Context, next: NextFunction): Promise<void> => {
    const userId = ctx.from?.id;
    if (userId === undefined) {
      return;
    }
    const allowed = await userRepository.isAllowed(BigInt(userId));
    if (!allowed) {
      await ctx.reply(t("start.accessDenied"));
      return;
    }
    await userRepository.updateProfile(BigInt(userId), {
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
      lastName: ctx.from?.last_name,
    });
    await next();
  };
}
