import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../../src/ai/designGuide";
import { corporateTheme } from "../../src/pptx/themes/corporate";
import { SLIDE_COUNT_AUTO } from "../../src/config/constants";

describe("buildSystemPrompt", () => {
  it("includes the requested slide count", () => {
    const prompt = buildSystemPrompt(corporateTheme, 10, "o'zbek");
    expect(prompt).toContain("10 ta slayd");
  });

  it("lets Claude choose the slide count itself when SLIDE_COUNT_AUTO is passed", () => {
    const prompt = buildSystemPrompt(corporateTheme, SLIDE_COUNT_AUTO, "o'zbek");
    expect(prompt).not.toContain("-1 ta slayd");
    expect(prompt).toContain("o'zingiz slaydlar sonini tanlang");
  });

  it("includes the theme's colors so Claude does not invent its own", () => {
    const prompt = buildSystemPrompt(corporateTheme, 5, "o'zbek");
    expect(prompt).toContain(corporateTheme.primaryColor);
    expect(prompt).toContain(corporateTheme.secondaryColor);
  });

  it("lists the bridge functions and the curated icon names", () => {
    const prompt = buildSystemPrompt(corporateTheme, 5, "o'zbek");
    expect(prompt).toContain("addSlide(options?)");
    expect(prompt).toContain("addTable");
    expect(prompt).toContain("addNotes");
    expect(prompt).toContain("addIcon");
    expect(prompt).toContain("FaChartBar");
  });
});
