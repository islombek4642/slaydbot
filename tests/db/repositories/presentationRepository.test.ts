import { describe, it, expect, vi } from "vitest";
import { PresentationRepository } from "../../../src/db/repositories/presentationRepository";

function createMockDb() {
  return {
    presentation: {
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe("PresentationRepository", () => {
  it("create stores a PENDING record and returns its id", async () => {
    const db = createMockDb();
    db.presentation.create.mockResolvedValue({ id: "pres_1" });
    const repo = new PresentationRepository(db as any);
    const result = await repo.create({
      userId: 1n,
      topic: "AI tarixi",
      slideCount: 10,
      language: "uz",
      theme: "corporate",
    });
    expect(result).toEqual({ id: "pres_1" });
    expect(db.presentation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ topic: "AI tarixi", status: "PENDING" }),
      })
    );
  });

  it("markSuccess sets status to SUCCESS", async () => {
    const db = createMockDb();
    const repo = new PresentationRepository(db as any);
    await repo.markSuccess("pres_1");
    expect(db.presentation.update).toHaveBeenCalledWith({
      where: { id: "pres_1" },
      data: { status: "SUCCESS" },
    });
  });

  it("markFailed sets status to FAILED with an error message", async () => {
    const db = createMockDb();
    const repo = new PresentationRepository(db as any);
    await repo.markFailed("pres_1", "boom");
    expect(db.presentation.update).toHaveBeenCalledWith({
      where: { id: "pres_1" },
      data: { status: "FAILED", errorMessage: "boom" },
    });
  });
});
