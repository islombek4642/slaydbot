import { describe, it, expect, vi } from "vitest";
import { formatUserList } from "../../src/bot/formatUserList";

describe("formatUserList", () => {
  it("returns an empty string when there are no users", () => {
    const result = formatUserList([]);
    expect(result).toBe("");
  });

  it("formats each user as a numbered line", () => {
    const users = [
      { id: 111n, firstName: "Ali", username: null } as any,
      { id: 222n, firstName: null, username: "vali" } as any,
    ];
    const result = formatUserList(users);
    expect(result).toBe("1. Ali — ID: 111\n2. vali — ID: 222");
  });
});
