import { Injectable } from '@nestjs/common';
import { Prisma, Workspace, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class WorkspaceRepository {
  constructor(private readonly prisma: PrismaService) {}

  findBySlug(slug: string): Promise<Workspace | null> {
    return this.prisma.workspace.findFirst({
      where: { slug, deletedAt: null },
    });
  }

  findById(id: string): Promise<Workspace | null> {
    return this.prisma.workspace.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async slugExists(slug: string): Promise<boolean> {
    const found = await this.prisma.workspace.findFirst({
      where: { slug },
      select: { id: true },
    });
    return !!found;
  }

  listForUser(userId: string) {
    return this.prisma.workspaceMember.findMany({
      where: { userId, deletedAt: null, workspace: { deletedAt: null } },
      include: {
        workspace: true,
      },
      orderBy: { joinedAt: 'desc' },
    });
  }

  async createWithOwner(data: {
    name: string;
    slug: string;
    description?: string;
    timezone?: string;
    ownerId: string;
  }): Promise<Workspace> {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          timezone: data.timezone ?? 'UTC',
          ownerId: data.ownerId,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: data.ownerId,
          role: WorkspaceRole.OWNER,
        },
      });

      await tx.activityLog.create({
        data: {
          workspaceId: workspace.id,
          actorId: data.ownerId,
          action: 'WORKSPACE_CREATED',
          metadata: { name: workspace.name, slug: workspace.slug },
        },
      });

      return workspace;
    });
  }

  update(id: string, data: Prisma.WorkspaceUpdateInput): Promise<Workspace> {
    return this.prisma.workspace.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.workspace.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  countMembers(workspaceId: string): Promise<number> {
    return this.prisma.workspaceMember.count({
      where: { workspaceId, deletedAt: null },
    });
  }
}
