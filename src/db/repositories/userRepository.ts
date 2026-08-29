import type { Db } from "../client";

export interface UserRecord {
  id: bigint;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  addedById: bigint | null;
  createdAt: Date;
}

export interface UserProfile {
  username?: string;
  firstName?: string;
  lastName?: string;
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

  async add(id: bigint, addedById: bigint | null, profile: UserProfile = {}): Promise<UserRecord> {
    return this.db.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        addedById,
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
      },
    });
  }

  async updateProfile(id: bigint, profile: UserProfile): Promise<void> {
    await this.db.user.update({
      where: { id },
      data: { username: profile.username, firstName: profile.firstName, lastName: profile.lastName },
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
      update: {},
      create: { id, addedById: null },
    });
  }
}
