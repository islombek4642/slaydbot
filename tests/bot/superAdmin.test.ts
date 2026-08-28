import { describe, it, expect } from "vitest";
import { isSuperAdmin } from "../../src/bot/superAdmin";

describe("isSuperAdmin", () => {
  it("returns true when the ids match", () => {
    expect(isSuperAdmin(42n, 42n)).toBe(true);
  });

  it("returns false when the ids differ", () => {
    expect(isSuperAdmin(1n, 42n)).toBe(false);
  });
});
