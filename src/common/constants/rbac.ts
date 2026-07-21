/**
 * Workspace role hierarchy (higher index = more privilege).
 * SYSTEM_ADMIN is handled separately via User.systemRole.
 */
export const WORKSPACE_ROLE_RANK: Record<string, number> = {
  GUEST: 1,
  MEMBER: 2,
  PROJECT_MANAGER: 3,
  ADMIN: 4,
  OWNER: 5,
} as const;

export type WorkspaceRoleName = keyof typeof WORKSPACE_ROLE_RANK;

export const PERMISSIONS = {
  WORKSPACE_VIEW: 'workspace:view',
  WORKSPACE_UPDATE: 'workspace:update',
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_TRANSFER: 'workspace:transfer',
  WORKSPACE_ARCHIVE: 'workspace:archive',
  MEMBER_INVITE: 'member:invite',
  MEMBER_REMOVE: 'member:remove',
  MEMBER_ROLE_CHANGE: 'member:role_change',
  PROJECT_CREATE: 'project:create',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_ARCHIVE: 'project:archive',
  TASK_CREATE: 'task:create',
  TASK_UPDATE: 'task:update',
  TASK_DELETE: 'task:delete',
  TASK_ASSIGN: 'task:assign',
  COMMENT_CREATE: 'comment:create',
  COMMENT_DELETE: 'comment:delete',
  FILE_UPLOAD: 'file:upload',
  FILE_DELETE: 'file:delete',
  SETTINGS_MANAGE: 'settings:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Minimum role required for each permission */
export const ROLE_PERMISSIONS: Record<WorkspaceRoleName, Permission[]> = {
  GUEST: [PERMISSIONS.WORKSPACE_VIEW],
  MEMBER: [
    PERMISSIONS.WORKSPACE_VIEW,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.COMMENT_CREATE,
    PERMISSIONS.FILE_UPLOAD,
  ],
  PROJECT_MANAGER: [
    PERMISSIONS.WORKSPACE_VIEW,
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_UPDATE,
    PERMISSIONS.PROJECT_ARCHIVE,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.TASK_DELETE,
    PERMISSIONS.TASK_ASSIGN,
    PERMISSIONS.COMMENT_CREATE,
    PERMISSIONS.COMMENT_DELETE,
    PERMISSIONS.FILE_UPLOAD,
    PERMISSIONS.FILE_DELETE,
  ],
  ADMIN: [
    PERMISSIONS.WORKSPACE_VIEW,
    PERMISSIONS.WORKSPACE_UPDATE,
    PERMISSIONS.WORKSPACE_ARCHIVE,
    PERMISSIONS.MEMBER_INVITE,
    PERMISSIONS.MEMBER_REMOVE,
    PERMISSIONS.MEMBER_ROLE_CHANGE,
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_UPDATE,
    PERMISSIONS.PROJECT_DELETE,
    PERMISSIONS.PROJECT_ARCHIVE,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.TASK_DELETE,
    PERMISSIONS.TASK_ASSIGN,
    PERMISSIONS.COMMENT_CREATE,
    PERMISSIONS.COMMENT_DELETE,
    PERMISSIONS.FILE_UPLOAD,
    PERMISSIONS.FILE_DELETE,
    PERMISSIONS.SETTINGS_MANAGE,
  ],
  OWNER: Object.values(PERMISSIONS),
};

export function roleHasPermission(
  role: WorkspaceRoleName,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function roleAtLeast(
  role: WorkspaceRoleName,
  minimum: WorkspaceRoleName,
): boolean {
  return WORKSPACE_ROLE_RANK[role] >= WORKSPACE_ROLE_RANK[minimum];
}
