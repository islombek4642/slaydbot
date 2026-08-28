import { PrismaClient } from "@prisma/client";

export function createDbClient(): PrismaClient {
  return new PrismaClient();
}

export type Db = PrismaClient;
