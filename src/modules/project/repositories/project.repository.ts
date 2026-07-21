import { Injectable } from '@nestjs/common';
import { Prisma, Project } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  findBySlug(workspaceId: string, slug: string): Promise<Project | null> {
    return this.prisma.project.findFirst({
      where: { workspaceId, slug, deletedAt: null },
    });
  }

  findById(id: string): Promise<Project | null> {
    return this.prisma.project.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async slugExists(workspaceId: string, slug: string): Promise<boolean> {
    const found = await this.prisma.project.findFirst({
      where: { workspaceId, slug },
      select: { id: true },
    });
    return !!found;
  }

  listByWorkspace(workspaceId: string, userId: string) {
    return this.prisma.project.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        OR: [
          { visibility: 'WORKSPACE' },
          { members: { some: { userId, deletedAt: null } } },
        ],
      },
      include: {
        favorites: { where: { userId }, select: { id: true } },
        _count: { select: { tasks: { where: { deletedAt: null } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  create(data: Prisma.ProjectCreateInput): Promise<Project> {
    return this.prisma.project.create({ data });
  }

  update(id: string, data: Prisma.ProjectUpdateInput): Promise<Project> {
    return this.prisma.project.update({ where: { id }, data });
  }

  softDelete(id: string) {
    return this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  addFavorite(projectId: string, userId: string) {
    return this.prisma.projectFavorite.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { projectId, userId },
      update: {},
    });
  }

  removeFavorite(projectId: string, userId: string) {
    return this.prisma.projectFavorite.deleteMany({
      where: { projectId, userId },
    });
  }

  isFavorite(projectId: string, userId: string) {
    return this.prisma.projectFavorite.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
  }
}
