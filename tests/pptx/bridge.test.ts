import { describe, it, expect, vi } from "vitest";
import { createBridgeFunctions } from "../../src/pptx/bridge";
import { PresentationBuilder } from "../../src/pptx/presentationBuilder";
import { IconCache } from "../../src/pptx/icons/iconCache";

describe("createBridgeFunctions", () => {
  it("addSlide delegates to the builder and returns the slide index", () => {
    const builder = new PresentationBuilder();
    const bridge = createBridgeFunctions(builder, new IconCache());
    expect(bridge.addSlide()).toBe(0);
    expect(builder.slideCount()).toBe(1);
  });

  it("addSlide passes options (e.g. background) through to the builder", () => {
    const builder = new PresentationBuilder();
    const addSlideSpy = vi.spyOn(builder, "addSlide");
    const bridge = createBridgeFunctions(builder, new IconCache());
    bridge.addSlide({ background: "1F3864" });
    expect(addSlideSpy).toHaveBeenCalledWith({ background: "1F3864" });
  });

  it("addText delegates to the builder", () => {
    const builder = new PresentationBuilder();
    const addTextSpy = vi.spyOn(builder, "addText");
    const bridge = createBridgeFunctions(builder, new IconCache());
    bridge.addSlide();
    bridge.addText(0, "Salom", { bold: true });
    expect(addTextSpy).toHaveBeenCalledWith(0, "Salom", { bold: true });
  });

  it("addTable delegates to the builder", () => {
    const builder = new PresentationBuilder();
    const addTableSpy = vi.spyOn(builder, "addTable");
    const bridge = createBridgeFunctions(builder, new IconCache());
    bridge.addSlide();
    const rows = [[{ text: "a" }, { text: "b" }]];
    bridge.addTable(0, rows, { border: { type: "solid" } });
    expect(addTableSpy).toHaveBeenCalledWith(0, rows, { border: { type: "solid" } });
  });

  it("addNotes delegates to the builder", () => {
    const builder = new PresentationBuilder();
    const addNotesSpy = vi.spyOn(builder, "addNotes");
    const bridge = createBridgeFunctions(builder, new IconCache());
    bridge.addSlide();
    bridge.addNotes(0, "eslatma");
    expect(addNotesSpy).toHaveBeenCalledWith(0, "eslatma");
  });

  it("addImage delegates to the builder when only data is given", () => {
    const builder = new PresentationBuilder();
    const addImageSpy = vi.spyOn(builder, "addImage");
    const bridge = createBridgeFunctions(builder, new IconCache());
    bridge.addSlide();
    bridge.addImage(0, { data: "data:image/png;base64,AAAA", x: 0, y: 0, w: 1, h: 1 });
    expect(addImageSpy).toHaveBeenCalledWith(0, { data: "data:image/png;base64,AAAA", x: 0, y: 0, w: 1, h: 1 });
  });

  it("addImage rejects a path (would fetch a URL or read a local file on the host)", () => {
    const builder = new PresentationBuilder();
    const addImageSpy = vi.spyOn(builder, "addImage");
    const bridge = createBridgeFunctions(builder, new IconCache());
    bridge.addSlide();
    expect(() => bridge.addImage(0, { path: "http://attacker.example/x", x: 0, y: 0, w: 1, h: 1 })).toThrow(
      /"path" is not allowed/
    );
    expect(addImageSpy).not.toHaveBeenCalled();
  });

  it("addIcon throws when the icon/color combo is not cached", () => {
    const builder = new PresentationBuilder();
    const bridge = createBridgeFunctions(builder, new IconCache());
    bridge.addSlide();
    expect(() => bridge.addIcon(0, "FaStar", { color: "FFFFFF", x: 0, y: 0, w: 1, h: 1 })).toThrow(
      /is not cached/
    );
  });

  it("addIcon adds an image using the cached data uri", () => {
    const builder = new PresentationBuilder();
    const iconCache = new IconCache();
    vi.spyOn(iconCache, "get").mockReturnValue("data:image/png;base64,AAAA");
    const addImageSpy = vi.spyOn(builder, "addImage");
    const bridge = createBridgeFunctions(builder, iconCache);
    bridge.addSlide();
    bridge.addIcon(0, "FaStar", { color: "FFFFFF", x: 1, y: 1, w: 2, h: 2 });
    expect(addImageSpy).toHaveBeenCalledWith(0, {
      data: "data:image/png;base64,AAAA",
      x: 1,
      y: 1,
      w: 2,
      h: 2,
    });
  });
});
