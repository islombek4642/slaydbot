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

  it("setModel changes the model used for subsequent requests", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "```javascript\naddSlide();\n```" }],
    });
    const client = new AiClient("test-key", "claude-opus-4-5");
    expect(client.getModel()).toBe("claude-opus-4-5");

    client.setModel("claude-sonnet-5");
    expect(client.getModel()).toBe("claude-sonnet-5");

    await client.generateSlideCode({ topic: "Test", slideCount: 5, language: "uz", theme });
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ model: "claude-sonnet-5" }));
  });

  it("throws when Claude returns no text block", async () => {
    createMock.mockResolvedValue({ content: [] });
    const client = new AiClient("test-key", "claude-opus-4-5");
    await expect(
      client.generateSlideCode({ topic: "Test", slideCount: 5, language: "uz", theme })
    ).rejects.toThrow(/did not return a text response/);
  });

  describe("retry on transient errors", () => {
    // A fast, spy-able stand-in for the real delay so tests don't wait on
    // real multi-second setTimeout backoff.
    let delayMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      delayMock = vi.fn().mockResolvedValue(undefined);
    });

    function transientError(status: number | undefined) {
      const error = new Error(`transient ${String(status)}`) as Error & { status?: number };
      error.status = status;
      return error;
    }

    it("succeeds on the first attempt without retrying", async () => {
      createMock.mockResolvedValue({
        content: [{ type: "text", text: "```javascript\naddSlide();\n```" }],
      });
      const client = new AiClient("test-key", "claude-opus-4-5", delayMock);
      const code = await client.generateSlideCode({
        topic: "Test",
        slideCount: 5,
        language: "uz",
        theme,
      });
      expect(code).toBe("addSlide();");
      expect(createMock).toHaveBeenCalledTimes(1);
      expect(delayMock).not.toHaveBeenCalled();
    });

    it("retries once after a transient error and then succeeds", async () => {
      createMock
        .mockRejectedValueOnce(transientError(429))
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "```javascript\naddSlide();\n```" }],
        });
      const client = new AiClient("test-key", "claude-opus-4-5", delayMock);
      const code = await client.generateSlideCode({
        topic: "Test",
        slideCount: 5,
        language: "uz",
        theme,
      });
      expect(code).toBe("addSlide();");
      expect(createMock).toHaveBeenCalledTimes(2);
      expect(delayMock).toHaveBeenCalledTimes(1);
      expect(delayMock).toHaveBeenCalledWith(1000);
    });

    it("retries a 408 (request timeout) error and then succeeds", async () => {
      createMock
        .mockRejectedValueOnce(transientError(408))
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "```javascript\naddSlide();\n```" }],
        });
      const client = new AiClient("test-key", "claude-opus-4-5", delayMock);
      const code = await client.generateSlideCode({
        topic: "Test",
        slideCount: 5,
        language: "uz",
        theme,
      });
      expect(code).toBe("addSlide();");
      expect(createMock).toHaveBeenCalledTimes(2);
      expect(delayMock).toHaveBeenCalledTimes(1);
      expect(delayMock).toHaveBeenCalledWith(1000);
    });

    it("does not retry on a non-transient error", async () => {
      const nonTransient = transientError(400);
      createMock.mockRejectedValue(nonTransient);
      const client = new AiClient("test-key", "claude-opus-4-5", delayMock);
      await expect(
        client.generateSlideCode({ topic: "Test", slideCount: 5, language: "uz", theme })
      ).rejects.toBe(nonTransient);
      expect(createMock).toHaveBeenCalledTimes(1);
      expect(delayMock).not.toHaveBeenCalled();
    });

    it("does not retry a plain error with no status", async () => {
      const plainError = new Error("boom");
      createMock.mockRejectedValue(plainError);
      const client = new AiClient("test-key", "claude-opus-4-5", delayMock);
      await expect(
        client.generateSlideCode({ topic: "Test", slideCount: 5, language: "uz", theme })
      ).rejects.toBe(plainError);
      expect(createMock).toHaveBeenCalledTimes(1);
      expect(delayMock).not.toHaveBeenCalled();
    });

    it("throws the last error after exhausting all retries", async () => {
      const err1 = transientError(500);
      const err2 = transientError(500);
      const err3 = transientError(500);
      createMock
        .mockRejectedValueOnce(err1)
        .mockRejectedValueOnce(err2)
        .mockRejectedValueOnce(err3);
      const client = new AiClient("test-key", "claude-opus-4-5", delayMock);
      await expect(
        client.generateSlideCode({ topic: "Test", slideCount: 5, language: "uz", theme })
      ).rejects.toBe(err3);
      expect(createMock).toHaveBeenCalledTimes(3);
      expect(delayMock).toHaveBeenCalledTimes(2);
      expect(delayMock).toHaveBeenNthCalledWith(1, 1000);
      expect(delayMock).toHaveBeenNthCalledWith(2, 2000);
    });
  });
});
