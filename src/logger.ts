import pino from "pino";

export function createLogger() {
  return pino({
    level: process.env.LOG_LEVEL ?? "info",
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type Logger = ReturnType<typeof createLogger>;
