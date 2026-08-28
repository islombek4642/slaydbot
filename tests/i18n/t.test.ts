import { describe, it, expect } from "vitest";
import { t } from "../../src/i18n/t";

describe("t", () => {
  it("returns the translation for a known key", () => {
    expect(t("wizard.cancelled")).toBe("Bekor qilindi.");
  });

  it("interpolates params", () => {
    const result = t("admin.listUsers.item", { index: 1, name: "Ali", id: 555 });
    expect(result).toBe("1. Ali — ID: 555");
  });

  it("throws for an unknown key", () => {
    expect(() => t("nonexistent.key" as any)).toThrow(/Missing translation/);
  });
});
