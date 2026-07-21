import { Injectable } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class WorkspaceMemberRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActive(workspaceId: string, userId: string) {
    return this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, deletedAt: null },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  list(workspaceId: string) {
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId, deletedAt: null },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: [{ role: 'desc' }, { joinedAt: 'asc' }],
    });
  }

  create(workspaceId: string, userId: string, role: WorkspaceRole) {
    return this.prisma.workspaceMember.create({
      data: { workspaceId, userId, role },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  updateRole(id: string, role: WorkspaceRole) {
    return this.prisma.workspaceMember.update({
      where: { id },
      data: { role },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  softDelete(id: string) {
    return this.prisma.workspaceMember.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
