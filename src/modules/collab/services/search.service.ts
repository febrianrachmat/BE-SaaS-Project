import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { SearchQueryDto } from '../dto/collab.dto';

type ProjectHit = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
};

type TaskHit = {
  id: string;
  title: string;
  status: string;
  priority: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
  projectIcon: string | null;
};

type CommentHit = {
  id: string;
  body: string;
  createdAt: Date;
  authorId: string;
  authorName: string;
  taskId: string;
  taskTitle: string;
  projectSlug: string;
  projectName: string;
};

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(ctx: WorkspaceContext, query: SearchQueryDto) {
    const q = query.q.trim();
    const limit = Math.min(Number(query.limit ?? 20) || 20, 50);
    const workspaceId = ctx.workspaceId;

    // Empty / whitespace-only already trimmed; short queries still work via FTS.
    const [projects, tasks, members, comments] = await Promise.all([
      this.searchProjects(workspaceId, q, limit),
      this.searchTasks(workspaceId, q, limit),
      this.prisma.workspaceMember.findMany({
        where: {
          workspaceId,
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
      this.searchComments(workspaceId, q, limit),
    ]);

    return {
      query: q,
      projects,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        project: {
          id: t.projectId,
          name: t.projectName,
          slug: t.projectSlug,
          icon: t.projectIcon,
        },
      })),
      members: members.map((m) => ({
        id: m.id,
        role: m.role,
        user: m.user,
      })),
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
        author: { id: c.authorId, name: c.authorName },
        task: {
          id: c.taskId,
          title: c.taskTitle,
          project: { slug: c.projectSlug, name: c.projectName },
        },
      })),
    };
  }

  private async searchProjects(
    workspaceId: string,
    q: string,
    limit: number,
  ): Promise<ProjectHit[]> {
    return this.prisma.$queryRaw<ProjectHit[]>(Prisma.sql`
      SELECT
        p.id,
        p.name,
        p.slug,
        p.icon,
        p.description
      FROM projects p
      WHERE p.workspace_id = ${workspaceId}::uuid
        AND p.deleted_at IS NULL
        AND to_tsvector(
          'simple',
          coalesce(p.name, '') || ' ' || coalesce(p.description, '') || ' ' || coalesce(p.slug, '')
        ) @@ plainto_tsquery('simple', ${q})
      ORDER BY ts_rank(
        to_tsvector(
          'simple',
          coalesce(p.name, '') || ' ' || coalesce(p.description, '') || ' ' || coalesce(p.slug, '')
        ),
        plainto_tsquery('simple', ${q})
      ) DESC,
      p.updated_at DESC
      LIMIT ${limit}
    `);
  }

  private async searchTasks(
    workspaceId: string,
    q: string,
    limit: number,
  ): Promise<TaskHit[]> {
    return this.prisma.$queryRaw<TaskHit[]>(Prisma.sql`
      SELECT
        t.id,
        t.title,
        t.status,
        t.priority,
        p.id AS "projectId",
        p.name AS "projectName",
        p.slug AS "projectSlug",
        p.icon AS "projectIcon"
      FROM tasks t
      INNER JOIN projects p ON p.id = t.project_id
      WHERE p.workspace_id = ${workspaceId}::uuid
        AND t.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND to_tsvector(
          'simple',
          coalesce(t.title, '') || ' ' || coalesce(t.description, '')
        ) @@ plainto_tsquery('simple', ${q})
      ORDER BY ts_rank(
        to_tsvector(
          'simple',
          coalesce(t.title, '') || ' ' || coalesce(t.description, '')
        ),
        plainto_tsquery('simple', ${q})
      ) DESC,
      t.updated_at DESC
      LIMIT ${limit}
    `);
  }

  private async searchComments(
    workspaceId: string,
    q: string,
    limit: number,
  ): Promise<CommentHit[]> {
    return this.prisma.$queryRaw<CommentHit[]>(Prisma.sql`
      SELECT
        c.id,
        c.body,
        c.created_at AS "createdAt",
        u.id AS "authorId",
        u.name AS "authorName",
        t.id AS "taskId",
        t.title AS "taskTitle",
        p.slug AS "projectSlug",
        p.name AS "projectName"
      FROM comments c
      INNER JOIN tasks t ON t.id = c.task_id
      INNER JOIN projects p ON p.id = t.project_id
      INNER JOIN users u ON u.id = c.author_id
      WHERE p.workspace_id = ${workspaceId}::uuid
        AND c.deleted_at IS NULL
        AND t.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND to_tsvector('simple', coalesce(c.body, ''))
            @@ plainto_tsquery('simple', ${q})
      ORDER BY ts_rank(
        to_tsvector('simple', coalesce(c.body, '')),
        plainto_tsquery('simple', ${q})
      ) DESC,
      c.created_at DESC
      LIMIT ${limit}
    `);
  }
}
