import { describe, it, expect, vi } from "vitest";
import { PresentationService } from "../../src/services/presentationService";

function createMockAiClient(code: string) {
  return { generateSlideCode: vi.fn().mockResolvedValue(code) } as any;
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

describe("PresentationService.generate", () => {
  it("returns a pptx buffer on success and marks the record successful", async () => {
    const aiClient = createMockAiClient('const s = addSlide(); addText(s, "Salom");');
    const repo = createMockPresentationRepository();
    const service = new PresentationService(aiClient, repo, createMockIconCache());

    const result = await service.generate({
      userId: 1n,
      topic: "Test",
      slideCount: 1,
      language: "o'zbek",
      themeName: "corporate",
    });

    expect(result.success).toBe(true);
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(repo.markSuccess).toHaveBeenCalledWith("pres_1");
    expect(repo.markFailed).not.toHaveBeenCalled();
  });

  it("fails and records the reason when generated code trips the validator", async () => {
    const aiClient = createMockAiClient("require('fs');");
    const repo = createMockPresentationRepository();
    const service = new PresentationService(aiClient, repo, createMockIconCache());

    const result = await service.generate({
      userId: 1n,
      topic: "Test",
      slideCount: 1,
      language: "o'zbek",
      themeName: "corporate",
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toMatch(/banned pattern/);
    expect(repo.markFailed).toHaveBeenCalledWith("pres_1", expect.stringContaining("banned pattern"));
  });

  it("fails and records the reason when the sandboxed code throws", async () => {
    const aiClient = createMockAiClient("throw new Error('bad code');");
    const repo = createMockPresentationRepository();
    const service = new PresentationService(aiClient, repo, createMockIconCache());

    const result = await service.generate({
      userId: 1n,
      topic: "Test",
      slideCount: 1,
      language: "o'zbek",
      themeName: "corporate",
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("bad code");
  });

  it("resolves with success:false and does not call markFailed when create() itself throws", async () => {
    const aiClient = createMockAiClient('const s = addSlide(); addText(s, "Salom");');
    const repo = createMockPresentationRepository();
    repo.create = vi.fn().mockRejectedValue(new Error("db down"));
    const service = new PresentationService(aiClient, repo, createMockIconCache());

    const result = await service.generate({
      userId: 1n,
      topic: "Test",
      slideCount: 1,
      language: "o'zbek",
      themeName: "corporate",
    });

    expect(result).toEqual({ success: false, errorMessage: "db down" });
    expect(repo.markFailed).not.toHaveBeenCalled();
  });

  it("logs a requestId at start and success with structured fields when generation succeeds", async () => {
    const aiClient = createMockAiClient('const s = addSlide(); addText(s, "Salom");');
    const repo = createMockPresentationRepository();
    const logger = createMockLogger();
    const service = new PresentationService(aiClient, repo, createMockIconCache(), logger);

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

  it("logs a requestId at start and error with structured fields when generation fails", async () => {
    const aiClient = createMockAiClient("throw new Error('bad code');");
    const repo = createMockPresentationRepository();
    const logger = createMockLogger();
    const service = new PresentationService(aiClient, repo, createMockIconCache(), logger);

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
