export function isSuperAdmin(userId: bigint, superAdminId: bigint): boolean {
  return userId === superAdminId;
}
