import { describe, it, expect, vi } from "vitest";
import { SettingRepository } from "../../../src/db/repositories/settingRepository";

function createMockDb() {
  return {
    setting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  };
}

describe("SettingRepository", () => {
  it("get returns the stored value", async () => {
    const db = createMockDb();
    db.setting.findUnique.mockResolvedValue({ key: "aiModel", value: "claude-opus-5" });
    const repo = new SettingRepository(db as any);
    await expect(repo.get("aiModel")).resolves.toBe("claude-opus-5");
  });

  it("get returns null when the key is not set", async () => {
    const db = createMockDb();
    db.setting.findUnique.mockResolvedValue(null);
    const repo = new SettingRepository(db as any);
    await expect(repo.get("aiModel")).resolves.toBeNull();
  });

  it("set upserts the key/value pair", async () => {
    const db = createMockDb();
    const repo = new SettingRepository(db as any);
    await repo.set("aiModel", "claude-sonnet-5");
    expect(db.setting.upsert).toHaveBeenCalledWith({
      where: { key: "aiModel" },
      update: { value: "claude-sonnet-5" },
      create: { key: "aiModel", value: "claude-sonnet-5" },
    });
  });
});
