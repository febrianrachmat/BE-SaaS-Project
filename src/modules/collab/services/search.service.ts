import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { SearchQueryDto } from '../dto/collab.dto';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(ctx: WorkspaceContext, query: SearchQueryDto) {
    const q = query.q.trim();
    const limit = Math.min(Number(query.limit ?? 20) || 20, 50);

    const [projects, tasks, members, comments] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          deletedAt: null,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          icon: true,
          description: true,
        },
      }),
      this.prisma.task.findMany({
        where: {
          deletedAt: null,
          project: { workspaceId: ctx.workspaceId, deletedAt: null },
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          project: { select: { id: true, name: true, slug: true, icon: true } },
        },
      }),
      this.prisma.workspaceMember.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          deletedAt: null,
          user: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      }),
      this.prisma.comment.findMany({
        where: {
          deletedAt: null,
          body: { contains: q, mode: 'insensitive' },
          task: {
            deletedAt: null,
            project: { workspaceId: ctx.workspaceId, deletedAt: null },
          },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { id: true, name: true } },
          task: {
            select: {
              id: true,
              title: true,
              project: { select: { slug: true, name: true } },
            },
          },
        },
      }),
    ]);

    return {
      query: q,
      projects,
      tasks,
      members: members.map((m) => ({
        id: m.id,
        role: m.role,
        user: m.user,
      })),
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
        author: c.author,
        task: c.task,
      })),
    };
  }
}
