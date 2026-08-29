import type { Db } from "../client";

export class SettingRepository {
  constructor(private readonly db: Db) {}

  async get(key: string): Promise<string | null> {
    const row = await this.db.setting.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
