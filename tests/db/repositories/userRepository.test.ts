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
    db.user.findUnique.mockResolvedValue({ id: 1n });
    const repo = new UserRepository(db as any);
    await expect(repo.isAllowed(1n)).resolves.toBe(true);
  });

  it("isAllowed returns false when the user does not exist", async () => {
    const db = createMockDb();
    db.user.findUnique.mockResolvedValue(null);
    const repo = new UserRepository(db as any);
    await expect(repo.isAllowed(1n)).resolves.toBe(false);
  });

  it("add upserts a new admin user recording who added them", async () => {
    const db = createMockDb();
    db.user.upsert.mockResolvedValue({ id: 2n });
    const repo = new UserRepository(db as any);
    await repo.add(2n, 1n, { username: "ali", firstName: "Ali", lastName: "Valiyev" });
    expect(db.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 2n },
        create: expect.objectContaining({
          id: 2n,
          addedById: 1n,
          username: "ali",
          firstName: "Ali",
          lastName: "Valiyev",
        }),
      })
    );
  });

  it("updateProfile updates the user's username, first name, and last name", async () => {
    const db = createMockDb();
    const repo = new UserRepository(db as any);
    await repo.updateProfile(3n, { username: "vali", firstName: "Vali", lastName: "Karimov" });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 3n },
      data: { username: "vali", firstName: "Vali", lastName: "Karimov" },
    });
  });

  it("remove deletes the user by id", async () => {
    const db = createMockDb();
    const repo = new UserRepository(db as any);
    await repo.remove(5n);
    expect(db.user.delete).toHaveBeenCalledWith({ where: { id: 5n } });
  });

  it("ensureSuperAdmin upserts the given id as an admin", async () => {
    const db = createMockDb();
    const repo = new UserRepository(db as any);
    await repo.ensureSuperAdmin(9n);
    expect(db.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 9n },
        update: {},
        create: expect.objectContaining({ id: 9n, addedById: null }),
      })
    );
  });
});
