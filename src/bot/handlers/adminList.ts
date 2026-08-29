import type { Context } from "grammy";
import type { UserRecord, UserRepository } from "../../db/repositories/userRepository";
import { isSuperAdmin } from "../superAdmin";
import { t } from "../../i18n/t";
import { buildAdminListMenuKeyboard } from "../keyboards/adminListMenu";
import { buildAdminDeleteConfirmKeyboard, buildAdminListInlineKeyboard } from "../keyboards/adminListInline";
import { formatAdminCard } from "../formatAdminCard";

async function getManageableAdmins(userRepository: UserRepository, superAdminId: bigint): Promise<UserRecord[]> {
  const all = await userRepository.listAll();
  return all.filter((user) => !isSuperAdmin(user.id, superAdminId));
}

export function createAdminListEntryHandler(userRepository: UserRepository, superAdminId: bigint) {
  return async (ctx: Context): Promise<void> => {
    const userId = ctx.from?.id;
    if (userId === undefined || !isSuperAdmin(BigInt(userId), superAdminId)) {
      return;
    }

    await ctx.reply(t("admin.adminsButton"), { reply_markup: buildAdminListMenuKeyboard() });

    const admins = await getManageableAdmins(userRepository, superAdminId);
    if (admins.length === 0) {
      await ctx.reply(t("admin.list.empty"));
      return;
    }

    const first = admins[0];
    await ctx.reply(formatAdminCard(first, 1, admins.length), {
      reply_markup: buildAdminListInlineKeyboard(first.id, 0, admins.length),
    });
  };
}

export function createAdminListCallbackHandler(userRepository: UserRepository, superAdminId: bigint) {
  return async (ctx: Context): Promise<void> => {
    const userId = ctx.from?.id;
    if (userId === undefined || !isSuperAdmin(BigInt(userId), superAdminId)) {
      await ctx.answerCallbackQuery();
      return;
    }

    const data = ctx.callbackQuery?.data;
    if (data === undefined) {
      await ctx.answerCallbackQuery();
      return;
    }

    const [, action, ...rest] = data.split(":");

    const renderPage = async (page: number): Promise<void> => {
      const admins = await getManageableAdmins(userRepository, superAdminId);
      if (admins.length === 0) {
        await ctx.editMessageText(t("admin.list.empty"));
        return;
      }
      const clampedPage = ((page % admins.length) + admins.length) % admins.length;
      const admin = admins[clampedPage];
      await ctx.editMessageText(formatAdminCard(admin, clampedPage + 1, admins.length), {
        reply_markup: buildAdminListInlineKeyboard(admin.id, clampedPage, admins.length),
      });
    };

    switch (action) {
      case "page": {
        await renderPage(Number(rest[0]));
        await ctx.answerCallbackQuery();
        return;
      }

      case "askDelete": {
        const targetId = BigInt(rest[0]);
        const page = Number(rest[1]);
        const admins = await getManageableAdmins(userRepository, superAdminId);
        const admin = admins.find((candidate) => candidate.id === targetId);
        if (admin === undefined) {
          // Stale button (e.g. already deleted elsewhere) - just re-render the list.
          await renderPage(page);
          await ctx.answerCallbackQuery();
          return;
        }
        await ctx.editMessageText(
          t("admin.list.confirmDelete", {
            name: admin.firstName ?? admin.username ?? "—",
            id: admin.id.toString(),
          }),
          { reply_markup: buildAdminDeleteConfirmKeyboard(admin.id, page) }
        );
        await ctx.answerCallbackQuery();
        return;
      }

      case "confirmDelete": {
        const targetId = BigInt(rest[0]);
        const page = Number(rest[1]);
        try {
          await userRepository.remove(targetId);
        } catch {
          // Already removed by a prior/duplicate tap - fall through to re-render.
        }
        const remaining = await getManageableAdmins(userRepository, superAdminId);
        if (remaining.length === 0) {
          await ctx.editMessageText(t("admin.list.empty"));
        } else {
          const nextPage = Math.min(page, remaining.length - 1);
          const admin = remaining[nextPage];
          await ctx.editMessageText(formatAdminCard(admin, nextPage + 1, remaining.length), {
            reply_markup: buildAdminListInlineKeyboard(admin.id, nextPage, remaining.length),
          });
        }
        await ctx.answerCallbackQuery(t("admin.list.deleted"));
        return;
      }

      case "cancelDelete": {
        await renderPage(Number(rest[0]));
        await ctx.answerCallbackQuery();
        return;
      }

      default: {
        await ctx.answerCallbackQuery();
      }
    }
  };
}
