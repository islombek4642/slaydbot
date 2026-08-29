import { describe, it, expect } from "vitest";
import { t } from "../../src/i18n/t";

describe("t", () => {
  it("returns the translation for a known key", () => {
    expect(t("wizard.cancelled")).toBe("Bekor qilindi.");
  });

  it("interpolates params", () => {
    const result = t("admin.list.confirmDelete", { name: "Ali", id: 555 });
    expect(result).toBe("Rostdan ham Ali (ID: 555) ni o'chirmoqchimisiz?");
  });

  it("throws for an unknown key", () => {
    expect(() => t("nonexistent.key" as any)).toThrow(/Missing translation/);
  });
});
