import type { Permission } from '../constants/rbac';

/**
 * Empty scopes = legacy unrestricted (creator role still applies in PermissionsGuard).
 */
export function apiKeyAllowsPermission(
  scopes: string[] | undefined,
  permission: Permission,
): boolean {
  if (!scopes?.length) return true;
  return scopes.includes(permission);
}
