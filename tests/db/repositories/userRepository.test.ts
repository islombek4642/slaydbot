import { describe, it, expect, vi } from "vitest";
import { UserRepository } from "../../../src/db/repositories/userRepository";

function createMockDb() {
  return {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  };
}

describe("UserRepository", () => {
  it("isAllowed returns true when the user exists", async () => {
    const db = createMockDb();
    db.user.findUnique.mockResolvedValue({ id: 1n, isAdmin: false });
    const repo = new UserRepository(db as any);
    await expect(repo.isAllowed(1n)).resolves.toBe(true);
  });

  it("isAllowed returns false when the user does not exist", async () => {
    const db = createMockDb();
    db.user.findUnique.mockResolvedValue(null);
    const repo = new UserRepository(db as any);
    await expect(repo.isAllowed(1n)).resolves.toBe(false);
  });

  it("isAdmin returns the stored isAdmin flag", async () => {
    const db = createMockDb();
    db.user.findUnique.mockResolvedValue({ id: 1n, isAdmin: true });
    const repo = new UserRepository(db as any);
    await expect(repo.isAdmin(1n)).resolves.toBe(true);
  });

  it("isAdmin returns false for a user that does not exist", async () => {
    const db = createMockDb();
    db.user.findUnique.mockResolvedValue(null);
    const repo = new UserRepository(db as any);
    await expect(repo.isAdmin(1n)).resolves.toBe(false);
  });

  it("add upserts a non-admin user recording who added them", async () => {
    const db = createMockDb();
    db.user.upsert.mockResolvedValue({ id: 2n, isAdmin: false });
    const repo = new UserRepository(db as any);
    await repo.add(2n, 1n, { username: "ali" });
    expect(db.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 2n },
        create: expect.objectContaining({ id: 2n, addedById: 1n, isAdmin: false, username: "ali" }),
      })
    );
  });

  it("remove deletes the user by id", async () => {
    const db = createMockDb();
    const repo = new UserRepository(db as any);
    await repo.remove(5n);
    expect(db.user.delete).toHaveBeenCalledWith({ where: { id: 5n } });
  });

  it("promote sets isAdmin to true", async () => {
    const db = createMockDb();
    const repo = new UserRepository(db as any);
    await repo.promote(5n);
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 5n }, data: { isAdmin: true } });
  });

  it("ensureSuperAdmin upserts the given id as an admin", async () => {
    const db = createMockDb();
    const repo = new UserRepository(db as any);
    await repo.ensureSuperAdmin(9n);
    expect(db.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 9n },
        update: { isAdmin: true },
        create: expect.objectContaining({ id: 9n, isAdmin: true, addedById: null }),
      })
    );
  });
});
