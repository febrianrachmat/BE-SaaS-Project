import {
  PERMISSIONS,
  roleAtLeast,
  roleHasPermission,
} from '../constants/rbac';

describe('RBAC helpers', () => {
  it('grants OWNER all permissions', () => {
    expect(roleHasPermission('OWNER', PERMISSIONS.WORKSPACE_DELETE)).toBe(true);
    expect(roleHasPermission('OWNER', PERMISSIONS.TASK_CREATE)).toBe(true);
  });

  it('restricts GUEST to view-only workspace access', () => {
    expect(roleHasPermission('GUEST', PERMISSIONS.WORKSPACE_VIEW)).toBe(true);
    expect(roleHasPermission('GUEST', PERMISSIONS.TASK_CREATE)).toBe(false);
    expect(roleHasPermission('GUEST', PERMISSIONS.MEMBER_INVITE)).toBe(false);
  });

  it('allows MEMBER to create tasks but not invite', () => {
    expect(roleHasPermission('MEMBER', PERMISSIONS.TASK_CREATE)).toBe(true);
    expect(roleHasPermission('MEMBER', PERMISSIONS.MEMBER_INVITE)).toBe(false);
  });

  it('compares role ranks', () => {
    expect(roleAtLeast('ADMIN', 'MEMBER')).toBe(true);
    expect(roleAtLeast('MEMBER', 'ADMIN')).toBe(false);
    expect(roleAtLeast('OWNER', 'OWNER')).toBe(true);
  });
});
