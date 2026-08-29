import type { Db } from "../client";

export interface UserRecord {
  id: bigint;
  username: string | null;
  firstName: string | null;
  isAdmin: boolean;
  addedById: bigint | null;
  createdAt: Date;
}

export interface UserProfile {
  username?: string;
  firstName?: string;
}

export class UserRepository {
  constructor(private readonly db: Db) {}

  async findById(id: bigint): Promise<UserRecord | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  async isAllowed(id: bigint): Promise<boolean> {
    const user = await this.findById(id);
    return user !== null;
  }

  async isAdmin(id: bigint): Promise<boolean> {
    const user = await this.findById(id);
    return user?.isAdmin ?? false;
  }

  async add(id: bigint, addedById: bigint | null, profile: UserProfile = {}): Promise<UserRecord> {
    return this.db.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        addedById,
        username: profile.username,
        firstName: profile.firstName,
        isAdmin: true,
      },
    });
  }

  async remove(id: bigint): Promise<void> {
    await this.db.user.delete({ where: { id } });
  }

  async listAll(): Promise<UserRecord[]> {
    return this.db.user.findMany({ orderBy: { createdAt: "asc" } });
  }

  async ensureSuperAdmin(id: bigint): Promise<void> {
    await this.db.user.upsert({
      where: { id },
      update: { isAdmin: true },
      create: { id, isAdmin: true, addedById: null },
    });
  }
}
