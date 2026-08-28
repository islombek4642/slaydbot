import type { Db } from "../client";

export interface CreatePresentationInput {
  userId: bigint;
  topic: string;
  slideCount: number;
  language: string;
  theme: string;
}

export class PresentationRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreatePresentationInput): Promise<{ id: string }> {
    return this.db.presentation.create({
      data: { ...input, status: "PENDING" },
      select: { id: true },
    });
  }

  async markSuccess(id: string): Promise<void> {
    await this.db.presentation.update({ where: { id }, data: { status: "SUCCESS" } });
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await this.db.presentation.update({
      where: { id },
      data: { status: "FAILED", errorMessage },
    });
  }
}
