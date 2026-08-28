import { describe, it, expect } from "vitest";
import { PresentationBuilder } from "../../src/pptx/presentationBuilder";

describe("PresentationBuilder", () => {
  it("creates a slide and returns its index", () => {
    const builder = new PresentationBuilder();
    const index = builder.addSlide();
    expect(index).toBe(0);
    expect(builder.slideCount()).toBe(1);
  });

  it("assigns increasing indexes to subsequent slides", () => {
    const builder = new PresentationBuilder();
    expect(builder.addSlide()).toBe(0);
    expect(builder.addSlide()).toBe(1);
    expect(builder.slideCount()).toBe(2);
  });

  it("throws when adding text to a non-existent slide", () => {
    const builder = new PresentationBuilder();
    expect(() => builder.addText(0, "Salom")).toThrow(/Slide index 0 does not exist/);
  });

  it("produces a non-empty pptx buffer", async () => {
    const builder = new PresentationBuilder();
    const index = builder.addSlide();
    builder.addText(index, "Salom dunyo");
    const buffer = await builder.toBuffer();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
