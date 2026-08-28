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
});
