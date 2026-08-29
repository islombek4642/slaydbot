import "dotenv/config";
import { createServer } from "node:http";
import { webhookCallback } from "grammy";
import { loadEnv } from "./config/env";
import { createDbClient } from "./db/client";
import { UserRepository } from "./db/repositories/userRepository";
import { PresentationRepository } from "./db/repositories/presentationRepository";
import { SettingRepository } from "./db/repositories/settingRepository";
import { AI_MODEL_SETTING_KEY } from "./config/constants";
import { AiClient } from "./ai/client";
import { PresentationService } from "./services/presentationService";
import { IconCache } from "./pptx/icons/iconCache";
import { createBot } from "./bot";
import { createLogger } from "./logger";
import { t } from "./i18n/t";

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger();
  const db = createDbClient(env.DATABASE_URL);
  const userRepository = new UserRepository(db);
  const presentationRepository = new PresentationRepository(db);
  const settingRepository = new SettingRepository(db);

  await userRepository.ensureSuperAdmin(env.SUPER_ADMIN_ID);

  // The admin panel's model choice (persisted here) overrides CLAUDE_MODEL
  // once one has ever been picked; CLAUDE_MODEL only seeds the very first run.
  const storedModel = await settingRepository.get(AI_MODEL_SETTING_KEY);
  const model = storedModel ?? env.CLAUDE_MODEL;

  const aiClient = env.ANTHROPIC_API_KEY ? new AiClient(env.ANTHROPIC_API_KEY, model) : null;
  if (!aiClient) {
    logger.warn("ANTHROPIC_API_KEY is not set; AI presentation generation is disabled until it is configured");
  }
  const presentationService = new PresentationService(
    aiClient,
    presentationRepository,
    new IconCache(),
    logger
  );

  const bot = createBot({
    botToken: env.BOT_TOKEN,
    superAdminId: env.SUPER_ADMIN_ID,
    userRepository,
    settingRepository,
    presentationService,
  });

  await bot.init();

  // Only /start and /help are meant to appear in Telegram clients' "/"
  // command menu (per the design spec) - everything else is button-driven.
  // bot.command(...) alone only registers a handler; the visible menu
  // needs this separate call.
  await bot.api.setMyCommands([
    { command: "start", description: t("start.commandDescription") },
    { command: "help", description: t("help.commandDescription") },
  ]);

  const handleUpdate = webhookCallback(bot, "http", { secretToken: env.WEBHOOK_SECRET });

  const server = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }
    if (req.url === "/webhook" && req.method === "POST") {
      handleUpdate(req, res).catch((error) => {
        logger.error({ error }, "Failed to handle Telegram update");
        if (!res.writableEnded) {
          res.writeHead(500);
          res.end();
        }
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "Server listening");
  });

  await bot.api.setWebhook(`https://${env.WEBHOOK_DOMAIN}/webhook`, {
    secret_token: env.WEBHOOK_SECRET,
  });

  logger.info({ domain: env.WEBHOOK_DOMAIN }, "Webhook registered");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
