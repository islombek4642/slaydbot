import { describe, it, expect } from "vitest";
import { renderIconToSvg, renderIconToPngDataUri } from "../../../src/pptx/icons/renderer";

describe("icon renderer", () => {
  it("renders a known icon to an svg string containing the requested color", () => {
    const svg = renderIconToSvg("FaStar", "FF0000");
    expect(svg).toContain("<svg");
    expect(svg).toContain("#FF0000");
  });

  it("throws for an unknown icon name", () => {
    expect(() => renderIconToSvg("NotAnIcon" as any, "FF0000")).toThrow(/Unknown icon/);
  });

  it("renders a known icon to a base64 png data uri", async () => {
    const dataUri = await renderIconToPngDataUri("FaStar", "FF0000");
    expect(dataUri.startsWith("data:image/png;base64,")).toBe(true);
    expect(dataUri.length).toBeGreaterThan(50);
  });
});
