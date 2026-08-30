import { describe, it, expect, vi } from "vitest";
import { PresentationService } from "../../src/services/presentationService";

function createMockAiClient(code: string, reviewResult: { issues: string[] } = { issues: [] }) {
  return {
    generateSlideCode: vi.fn().mockResolvedValue(code),
    reviewSlides: vi.fn().mockResolvedValue(reviewResult),
    getModel: vi.fn().mockReturnValue("claude-sonnet-5"),
    setModel: vi.fn(),
  } as any;
}

function createMockPresentationRepository() {
  return {
    create: vi.fn().mockResolvedValue({ id: "pres_1" }),
    markSuccess: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function createMockIconCache() {
  return { warmTheme: vi.fn().mockResolvedValue(undefined), get: vi.fn() } as any;
}

function createMockLogger() {
  return { info: vi.fn(), error: vi.fn(), warn: vi.fn() } as any;
}

const stubRenderSlides = () => Promise.resolve([]); // renderSlides stub: no images -> reviewSlides still gets called with []

describe("PresentationService.generate", () => {
  it("returns a pptx buffer on success and marks the record successful", async () => {
    const aiClient = createMockAiClient('const s = addSlide(); addText(s, "Salom");');
    const repo = createMockPresentationRepository();
    const service = new PresentationService(aiClient, repo, createMockIconCache(), createMockLogger(), stubRenderSlides);

    const result = await service.generate({
      userId: 1n,
      topic: "Test",
      slideCount: 1,
      language: "o'zbek",
      themeName: "corporate",
    });

    expect(result.success).toBe(true);
    expect(result.requestId).toEqual(expect.any(String));
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(repo.markSuccess).toHaveBeenCalledWith("pres_1");
    expect(repo.markFailed).not.toHaveBeenCalled();
  });

  it("succeeds end-to-end with a dark-background slide, a table, and speaker notes", async () => {
    const code = `
      const s = addSlide({ background: "1F3864" });
      addText(s, "Salom", { color: "FFFFFF" });
      addTable(s, [[{ text: "Ustun 1" }, { text: "Ustun 2" }]]);
      addNotes(s, "Taqdimotchi uchun izoh");
    `;
    const aiClient = createMockAiClient(code);
    const repo = createMockPresentationRepository();
    const service = new PresentationService(aiClient, repo, createMockIconCache(), createMockLogger(), stubRenderSlides);

    const result = await service.generate({
      userId: 1n,
      topic: "Test",
      slideCount: 1,
      language: "o'zbek",
      themeName: "corporate",
    });

    expect(result.success).toBe(true);
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(repo.markFailed).not.toHaveBeenCalled();
  });

  it("fails and records the reason when generated code trips the validator on every attempt", async () => {
    const aiClient = createMockAiClient("require('fs');");
    const repo = createMockPresentationRepository();
    const service = new PresentationService(
      aiClient,
      repo,
      createMockIconCache(),
      createMockLogger(),
      stubRenderSlides,
      2 // maxAttempts, kept small so the test doesn't spend 10 rounds on a fixed failure
    );

    const result = await service.generate({
      userId: 1n,
      topic: "Test",
      slideCount: 1,
      language: "o'zbek",
      themeName: "corporate",
    });

    expect(result.success).toBe(false);
    expect(result.requestId).toEqual(expect.any(String));
    expect(result.errorMessage).toMatch(/banned pattern/);
    expect(repo.markFailed).toHaveBeenCalledWith("pres_1", expect.stringContaining("banned pattern"));
    expect(aiClient.generateSlideCode).toHaveBeenCalledTimes(2);
  });

  it("fails and records the reason when the sandboxed code throws on every attempt", async () => {
    const aiClient = createMockAiClient("throw new Error('bad code');");
    const repo = createMockPresentationRepository();
    const service = new PresentationService(
      aiClient,
      repo,
      createMockIconCache(),
      createMockLogger(),
      stubRenderSlides,
      2
    );

    const result = await service.generate({
      userId: 1n,
      topic: "Test",
      slideCount: 1,
      language: "o'zbek",
      themeName: "corporate",
    });

    expect(result.success).toBe(false);
    expect(result.requestId).toEqual(expect.any(String));
    expect(result.errorMessage).toContain("bad code");
    expect(aiClient.generateSlideCode).toHaveBeenCalledTimes(2);
  });

  it("retries with feedback after a validation failure, then succeeds", async () => {
    const aiClient = createMockAiClient("require('fs');");
    aiClient.generateSlideCode
      .mockResolvedValueOnce("require('fs');")
      .mockResolvedValueOnce('const s = addSlide(); addText(s, "Salom");');
    const repo = createMockPresentationRepository();
    const service = new PresentationService(aiClient, repo, createMockIconCache(), createMockLogger(), stubRenderSlides);

    const result = await service.generate({
      userId: 1n,
      topic: "Test",
      slideCount: 1,
      language: "o'zbek",
      themeName: "corporate",
    });

    expect(result.success).toBe(true);
    expect(aiClient.generateSlideCode).toHaveBeenCalledTimes(2);
    const secondCallArgs = aiClient.generateSlideCode.mock.calls[1][0];
    expect(secondCallArgs.previousAttempt).toEqual({
      code: "require('fs');",
      feedback: expect.stringContaining("banned pattern"),
    });
  });

  it("retries with the visual QA issues as feedback, then succeeds once QA passes", async () => {
    const code = 'const s = addSlide(); addText(s, "Salom");';
    const aiClient = createMockAiClient(code);
    aiClient.reviewSlides
      .mockResolvedValueOnce({ issues: ["1-slaydda matn chiqib ketgan"] })
      .mockResolvedValueOnce({ issues: [] });
    const repo = createMockPresentationRepository();
    const renderSlides = vi.fn().mockResolvedValue([Buffer.from("fake-jpeg")]);
    const service = new PresentationService(aiClient, repo, createMockIconCache(), createMockLogger(), renderSlides);

    const result = await service.generate({
      userId: 1n,
      topic: "Test",
      slideCount: 1,
      language: "o'zbek",
      themeName: "corporate",
    });

    expect(result.success).toBe(true);
    expect(aiClient.generateSlideCode).toHaveBeenCalledTimes(2);
    expect(aiClient.reviewSlides).toHaveBeenCalledTimes(2);
    const secondCallArgs = aiClient.generateSlideCode.mock.calls[1][0];
    expect(secondCallArgs.previousAttempt.feedback).toContain("1-slaydda matn chiqib ketgan");
  });

  it("delivers the last valid buffer (not a failure) when the attempt cap is hit with lingering QA issues", async () => {
    const code = 'const s = addSlide(); addText(s, "Salom");';
    const aiClient = createMockAiClient(code, { issues: ["hech qachon tuzatilmaydigan muammo"] });
    const repo = createMockPresentationRepository();
    const renderSlides = vi.fn().mockResolvedValue([Buffer.from("fake-jpeg")]);
    const logger = createMockLogger();
    const service = new PresentationService(aiClient, repo, createMockIconCache(), logger, renderSlides, 3);

    const result = await service.generate({
      userId: 1n,
      topic: "Test",
      slideCount: 1,
      language: "o'zbek",
      themeName: "corporate",
    });

    expect(result.success).toBe(true);
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(aiClient.generateSlideCode).toHaveBeenCalledTimes(3);
    expect(repo.markSuccess).toHaveBeenCalledWith("pres_1");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ attempts: 3 }),
      expect.stringContaining("attempt cap")
    );
  });

  it("accepts the attempt as-is when rendering for visual QA fails (graceful degradation)", async () => {
    const code = 'const s = addSlide(); addText(s, "Salom");';
    const aiClient = createMockAiClient(code);
    const repo = createMockPresentationRepository();
    const renderSlides = vi.fn().mockRejectedValue(new Error("soffice not found"));
    const service = new PresentationService(aiClient, repo, createMockIconCache(), createMockLogger(), renderSlides);

    const result = await service.generate({
      userId: 1n,
      topic: "Test",
      slideCount: 1,
      language: "o'zbek",
      themeName: "corporate",
    });

    expect(result.success).toBe(true);
    expect(aiClient.reviewSlides).not.toHaveBeenCalled();
  });

  it("resolves with success:false and does not call markFailed when create() itself throws", async () => {
    const aiClient = createMockAiClient('const s = addSlide(); addText(s, "Salom");');
    const repo = createMockPresentationRepository();
    repo.create = vi.fn().mockRejectedValue(new Error("db down"));
    const service = new PresentationService(aiClient, repo, createMockIconCache(), createMockLogger(), stubRenderSlides);

    const result = await service.generate({
      userId: 1n,
      topic: "Test",
      slideCount: 1,
      language: "o'zbek",
      themeName: "corporate",
    });

    expect(result).toEqual({
      success: false,
      requestId: expect.any(String),
      errorMessage: "db down",
    });
    expect(repo.markFailed).not.toHaveBeenCalled();
  });

  it("logs a requestId at start and success with structured fields when generation succeeds", async () => {
    const aiClient = createMockAiClient('const s = addSlide(); addText(s, "Salom");');
    const repo = createMockPresentationRepository();
    const logger = createMockLogger();
    const service = new PresentationService(aiClient, repo, createMockIconCache(), logger, stubRenderSlides);

    const result = await service.generate({
      userId: 1n,
      topic: "Test",
      slideCount: 1,
      language: "o'zbek",
      themeName: "corporate",
    });

    expect(result.success).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: expect.any(String),
        userId: "1",
        topic: "Test",
        themeName: "corporate",
      }),
      "Presentation generation started"
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: expect.any(String), recordId: "pres_1" }),
      "Presentation generation succeeded"
    );
    expect(logger.error).not.toHaveBeenCalled();

    const startCall = logger.info.mock.calls.find(
      (call: any[]) => call[1] === "Presentation generation started"
    );
    const successCall = logger.info.mock.calls.find(
      (call: any[]) => call[1] === "Presentation generation succeeded"
    );
    expect(startCall![0].requestId).toBe(successCall![0].requestId);
  });

  it("fails gracefully and marks the record failed when aiClient is null (no API key configured)", async () => {
    const repo = createMockPresentationRepository();
    const service = new PresentationService(null, repo, createMockIconCache());

    const result = await service.generate({
      userId: 1n,
      topic: "Test",
      slideCount: 1,
      language: "o'zbek",
      themeName: "corporate",
    });

    expect(result).toEqual({
      success: false,
      requestId: expect.any(String),
      errorMessage: expect.stringContaining("ANTHROPIC_API_KEY"),
    });
    expect(repo.markFailed).toHaveBeenCalledWith("pres_1", expect.stringContaining("ANTHROPIC_API_KEY"));
  });

  it("logs a requestId at start and error with structured fields when generation fails", async () => {
    const aiClient = createMockAiClient("throw new Error('bad code');");
    const repo = createMockPresentationRepository();
    const logger = createMockLogger();
    const service = new PresentationService(aiClient, repo, createMockIconCache(), logger, stubRenderSlides, 1);

    const result = await service.generate({
      userId: 1n,
      topic: "Test",
      slideCount: 1,
      language: "o'zbek",
      themeName: "corporate",
    });

    expect(result.success).toBe(false);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: expect.any(String) }),
      "Presentation generation started"
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: expect.any(String),
        recordId: "pres_1",
        error: expect.stringContaining("bad code"),
      }),
      "Presentation generation failed"
    );
  });
});

describe("PresentationService model accessors", () => {
  it("getModel/setModel delegate to the underlying AiClient", () => {
    const aiClient = createMockAiClient("code");
    const service = new PresentationService(aiClient, createMockPresentationRepository(), createMockIconCache());

    expect(service.getModel()).toBe("claude-sonnet-5");
    service.setModel("claude-opus-5");
    expect(aiClient.setModel).toHaveBeenCalledWith("claude-opus-5");
  });

  it("getModel returns null and setModel is a no-op when there is no AiClient", () => {
    const service = new PresentationService(null, createMockPresentationRepository(), createMockIconCache());

    expect(service.getModel()).toBeNull();
    expect(() => service.setModel("claude-opus-5")).not.toThrow();
  });
});
