import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  Permission,
  roleHasPermission,
  WorkspaceRoleName,
} from '../constants/rbac';
import { AuthUser } from '../decorators/current-user.decorator';
import { WorkspaceContext } from '../decorators/current-workspace.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permission metadata → membership not required for this route
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthUser;
      params: { slug?: string; workspaceSlug?: string };
      workspaceContext?: WorkspaceContext;
      apiKeyAuth?: { apiKeyId: string; workspaceId: string };
    }>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const slug = request.params.slug ?? request.params.workspaceSlug;
    if (!slug) {
      // Non-workspace routes (e.g. /notifications) — allow authenticated user
      if (!required || required.length === 0) return true;
      if (user.systemRole === 'SYSTEM_ADMIN') return true;
      throw new ForbiddenException('Workspace slug is required');
    }

    const workspace = await this.prisma.workspace.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true, slug: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (
      request.apiKeyAuth &&
      request.apiKeyAuth.workspaceId !== workspace.id
    ) {
      throw new ForbiddenException(
        'API key is not valid for this workspace',
      );
    }

    if (user.systemRole === 'SYSTEM_ADMIN' && !request.apiKeyAuth) {
      request.workspaceContext = {
        workspaceId: workspace.id,
        slug: workspace.slug,
        role: 'OWNER' as WorkspaceRole,
        membershipId: 'system-admin',
      };
      return true;
    }

    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId: workspace.id,
        userId: user.id,
        deletedAt: null,
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    const role = membership.role as WorkspaceRoleName;
    const allowed = required.every((permission) =>
      roleHasPermission(role, permission),
    );

    if (!allowed) {
      throw new ForbiddenException('Insufficient permissions');
    }

    request.workspaceContext = {
      workspaceId: workspace.id,
      slug: workspace.slug,
      role: membership.role as WorkspaceRole,
      membershipId: membership.id,
    };

    return true;
  }
}
