import { describe, it, expect } from "vitest";
import { getTheme, THEMES } from "../../../src/pptx/themes";
import { THEME_NAMES } from "../../../src/config/constants";

describe("themes", () => {
  it("has a theme defined for every constant theme name", () => {
    for (const name of THEME_NAMES) {
      expect(THEMES[name]).toBeDefined();
      expect(getTheme(name).name).toBe(name);
    }
  });

  it("each theme has valid 6-digit hex colors", () => {
    const hexPattern = /^[0-9A-Fa-f]{6}$/;
    for (const theme of Object.values(THEMES)) {
      expect(theme.primaryColor).toMatch(hexPattern);
      expect(theme.secondaryColor).toMatch(hexPattern);
      expect(theme.backgroundColor).toMatch(hexPattern);
      expect(theme.textColor).toMatch(hexPattern);
    }
  });
});
