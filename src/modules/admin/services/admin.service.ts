import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        systemRole: true,
        emailVerifiedAt: true,
        createdAt: true,
        _count: {
          select: {
            workspaceMemberships: { where: { deletedAt: null } },
          },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatarUrl,
      systemRole: u.systemRole,
      emailVerifiedAt: u.emailVerifiedAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      workspaceCount: u._count.workspaceMemberships,
    }));
  }

  async stats() {
    const [users, workspaces, projects, tasks] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.workspace.count({ where: { deletedAt: null } }),
      this.prisma.project.count({ where: { deletedAt: null } }),
      this.prisma.task.count({ where: { deletedAt: null } }),
    ]);
    return { users, workspaces, projects, tasks };
  }

  async updateSystemRole(
    actorId: string,
    userId: string,
    systemRole?: SystemRole,
  ) {
    if (!systemRole) {
      throw new BadRequestException('systemRole is required');
    }
    if (actorId === userId && systemRole !== SystemRole.SYSTEM_ADMIN) {
      throw new BadRequestException('Cannot demote your own system admin role');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { systemRole },
      select: {
        id: true,
        email: true,
        name: true,
        systemRole: true,
      },
    });

    return updated;
  }
}
