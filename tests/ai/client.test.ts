import { describe, it, expect, vi, beforeEach } from "vitest";
import { AiClient, extractCodeBlock } from "../../src/ai/client";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  // Uses a `function` expression (not an arrow function) so that `new Anthropic(...)`
  // in the implementation under test is constructible: vitest's mock spy invokes
  // `Reflect.construct` on the configured implementation when called via `new`, and
  // arrow functions are never constructible, which would throw
  // "... is not a constructor" regardless of the implementation under test.
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: createMock } };
  }),
}));

describe("extractCodeBlock", () => {
  it("extracts code from a fenced javascript block", () => {
    const text = "Mana kod:\n```javascript\naddSlide();\n```";
    expect(extractCodeBlock(text)).toBe("addSlide();");
  });

  it("returns the raw text when there is no fence", () => {
    expect(extractCodeBlock("addSlide();")).toBe("addSlide();");
  });
});

describe("AiClient.generateSlideCode", () => {
  const theme = {
    name: "corporate",
    primaryColor: "111111",
    secondaryColor: "222222",
    backgroundColor: "FFFFFF",
    textColor: "000000",
    fontFace: "Calibri",
  };

  beforeEach(() => {
    createMock.mockReset();
  });

  it("sends the topic as the user message and returns the extracted code", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "```javascript\naddSlide();\n```" }],
    });
    const client = new AiClient("test-key", "claude-opus-4-5");
    const code = await client.generateSlideCode({
      topic: "Sun'iy intellekt",
      slideCount: 5,
      language: "o'zbek",
      theme,
    });
    expect(code).toBe("addSlide();");
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-opus-4-5",
        messages: [{ role: "user", content: "Taqdimot mavzusi: Sun'iy intellekt" }],
      })
    );
  });

  it("throws when Claude returns no text block", async () => {
    createMock.mockResolvedValue({ content: [] });
    const client = new AiClient("test-key", "claude-opus-4-5");
    await expect(
      client.generateSlideCode({ topic: "Test", slideCount: 5, language: "uz", theme })
    ).rejects.toThrow(/did not return a text response/);
  });
});
