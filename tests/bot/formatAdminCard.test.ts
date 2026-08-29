import { describe, it, expect } from "vitest";
import { formatAdminCard } from "../../src/bot/formatAdminCard";

describe("formatAdminCard", () => {
  it("formats an admin with both a name and a username", () => {
    const admin = { id: 111n, firstName: "Ali", lastName: null, username: "ali_dev" } as any;
    const result = formatAdminCard(admin, 2, 3);
    expect(result).toBe("👤 Admin (2 / 3)\n\nIsm: Ali\nUsername: @ali_dev\nID: 111");
  });

  it("falls back to placeholders when there is no name or username", () => {
    const admin = { id: 222n, firstName: null, lastName: null, username: null } as any;
    const result = formatAdminCard(admin, 1, 1);
    expect(result).toBe("👤 Admin (1 / 1)\n\nIsm: —\nUsername: —\nID: 222");
  });

  it("falls back to the username for the name when firstName is missing", () => {
    const admin = { id: 333n, firstName: null, lastName: null, username: "vali" } as any;
    const result = formatAdminCard(admin, 3, 3);
    expect(result).toBe("👤 Admin (3 / 3)\n\nIsm: vali\nUsername: @vali\nID: 333");
  });

  it("combines first and last name when both are present", () => {
    const admin = { id: 444n, firstName: "Ali", lastName: "Valiyev", username: "ali_dev" } as any;
    const result = formatAdminCard(admin, 1, 1);
    expect(result).toBe("👤 Admin (1 / 1)\n\nIsm: Ali Valiyev\nUsername: @ali_dev\nID: 444");
  });

  it("shows only the first name with no trailing space when lastName is missing", () => {
    const admin = { id: 555n, firstName: "Ali", lastName: null, username: "ali_dev" } as any;
    const result = formatAdminCard(admin, 1, 1);
    expect(result).toBe("👤 Admin (1 / 1)\n\nIsm: Ali\nUsername: @ali_dev\nID: 555");
  });
});
