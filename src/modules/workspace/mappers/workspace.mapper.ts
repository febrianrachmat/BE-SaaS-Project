import { Workspace, WorkspaceMember, WorkspaceRole } from '@prisma/client';

export type WorkspaceDto = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  timezone: string;
  ownerId: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  role?: WorkspaceRole;
  memberCount?: number;
};

export type MemberDto = {
  id: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
};

export function toWorkspaceDto(
  workspace: Workspace,
  extras?: { role?: WorkspaceRole; memberCount?: number },
): WorkspaceDto {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description,
    logoUrl: workspace.logoUrl,
    timezone: workspace.timezone,
    ownerId: workspace.ownerId,
    archivedAt: workspace.archivedAt?.toISOString() ?? null,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
    role: extras?.role,
    memberCount: extras?.memberCount,
  };
}

export function toMemberDto(
  member: WorkspaceMember & {
    user: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    };
  },
): MemberDto {
  return {
    id: member.id,
    userId: member.userId,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
    user: {
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      avatarUrl: member.user.avatarUrl,
    },
  };
}
