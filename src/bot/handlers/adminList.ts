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

/**
 * Handles a single parsed `adminList:...` action. Any parsing/lookup failure
 * (e.g. malformed callback data) is expected to throw and is caught by the
 * caller, which falls back to a bare `answerCallbackQuery()` so the pressed
 * button's loading spinner never hangs.
 */
async function handleAdminListAction(
  ctx: Context,
  userRepository: UserRepository,
  superAdminId: bigint,
  action: string,
  rest: string[]
): Promise<void> {
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
      const page = parseRequiredInt(rest[0]);
      await renderPage(page);
      await ctx.answerCallbackQuery();
      return;
    }

    case "askDelete": {
      const targetId = parseRequiredBigInt(rest[0]);
      const page = parseRequiredInt(rest[1]);
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
      const targetId = parseRequiredBigInt(rest[0]);
      const page = parseRequiredInt(rest[1]);
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
      const page = parseRequiredInt(rest[0]);
      await renderPage(page);
      await ctx.answerCallbackQuery();
      return;
    }

    default: {
      await ctx.answerCallbackQuery();
    }
  }
}

function parseRequiredInt(value: string | undefined): number {
  if (value === undefined || !/^-?\d+$/.test(value)) {
    throw new Error(`Invalid integer in adminList callback data: "${value}"`);
  }
  return Number(value);
}

function parseRequiredBigInt(value: string | undefined): bigint {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw new Error(`Invalid id in adminList callback data: "${value}"`);
  }
  return BigInt(value);
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

    try {
      await handleAdminListAction(ctx, userRepository, superAdminId, action, rest);
    } catch {
      // Malformed callback data (e.g. non-numeric page/id) or any other
      // unexpected failure while handling it - fail gracefully so the
      // Telegram client's loading spinner on the pressed button doesn't hang.
      await ctx.answerCallbackQuery();
    }
  };
}
