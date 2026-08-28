import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../../src/ai/designGuide";
import { corporateTheme } from "../../src/pptx/themes/corporate";

describe("buildSystemPrompt", () => {
  it("includes the requested slide count", () => {
    const prompt = buildSystemPrompt(corporateTheme, 10, "o'zbek");
    expect(prompt).toContain("10 ta slayd");
  });

  it("includes the theme's colors so Claude does not invent its own", () => {
    const prompt = buildSystemPrompt(corporateTheme, 5, "o'zbek");
    expect(prompt).toContain(corporateTheme.primaryColor);
    expect(prompt).toContain(corporateTheme.secondaryColor);
  });

  it("lists the bridge functions and the curated icon names", () => {
    const prompt = buildSystemPrompt(corporateTheme, 5, "o'zbek");
    expect(prompt).toContain("addSlide()");
    expect(prompt).toContain("addIcon");
    expect(prompt).toContain("FaChartBar");
  });
});
