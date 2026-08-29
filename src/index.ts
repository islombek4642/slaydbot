import "dotenv/config";
import { createServer } from "node:http";
import { webhookCallback } from "grammy";
import { loadEnv } from "./config/env";
import { createDbClient } from "./db/client";
import { UserRepository } from "./db/repositories/userRepository";
import { PresentationRepository } from "./db/repositories/presentationRepository";
import { AiClient } from "./ai/client";
import { PresentationService } from "./services/presentationService";
import { IconCache } from "./pptx/icons/iconCache";
import { createBot } from "./bot";
import { createLogger } from "./logger";

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger();
  const db = createDbClient(env.DATABASE_URL);
  const userRepository = new UserRepository(db);
  const presentationRepository = new PresentationRepository(db);

  await userRepository.ensureSuperAdmin(env.SUPER_ADMIN_ID);

  const aiClient = new AiClient(env.ANTHROPIC_API_KEY, env.CLAUDE_MODEL);
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
    presentationService,
  });

  await bot.init();

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
