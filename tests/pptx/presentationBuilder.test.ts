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

  it("sets a per-slide background color when requested", () => {
    const builder = new PresentationBuilder();
    const index = builder.addSlide({ background: "1F3864" });
    expect(index).toBe(0);
    expect(builder.slideCount()).toBe(1);
  });

  it("throws when adding a table to a non-existent slide", () => {
    const builder = new PresentationBuilder();
    expect(() => builder.addTable(0, [[{ text: "a" }]])).toThrow(/Slide index 0 does not exist/);
  });

  it("throws when adding notes to a non-existent slide", () => {
    const builder = new PresentationBuilder();
    expect(() => builder.addNotes(0, "eslatma")).toThrow(/Slide index 0 does not exist/);
  });

  it("produces a non-empty buffer for a deck using a table and notes", async () => {
    const builder = new PresentationBuilder();
    const index = builder.addSlide({ background: "1F3864" });
    builder.addTable(index, [[{ text: "Ustun 1" }, { text: "Ustun 2" }]]);
    builder.addNotes(index, "Taqdimotchi uchun izoh");
    const buffer = await builder.toBuffer();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
