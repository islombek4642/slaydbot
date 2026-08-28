import { describe, it, expect } from "vitest";
import { IconCache } from "../../../src/pptx/icons/iconCache";
import { corporateTheme } from "../../../src/pptx/themes/corporate";

describe("IconCache", () => {
  it("returns undefined before warming", () => {
    const cache = new IconCache();
    expect(cache.get("FaStar", corporateTheme.primaryColor)).toBeUndefined();
  });

  it("returns a png data uri after warming a theme", async () => {
    const cache = new IconCache();
    await cache.warmTheme(corporateTheme);
    const result = cache.get("FaStar", corporateTheme.primaryColor);
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it("lookup is case-insensitive on the color hex", async () => {
    const cache = new IconCache();
    await cache.warmTheme(corporateTheme);
    const upper = cache.get("FaStar", corporateTheme.primaryColor.toUpperCase());
    const lower = cache.get("FaStar", corporateTheme.primaryColor.toLowerCase());
    expect(upper).toBe(lower);
  });
});
