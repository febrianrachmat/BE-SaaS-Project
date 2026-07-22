import { Injectable } from '@nestjs/common';
import { ActivityAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';

export type ActivityItem = {
  id: string;
  action: ActivityAction;
  createdAt: string;
  metadata: unknown;
  actor: { id: string; name: string; avatarUrl: string | null };
  project: { id: string; name: string; slug: string } | null;
  task: { id: string; title: string } | null;
};

export type ActivityFeedResult = {
  items: ActivityItem[];
  nextCursor: string | null;
};

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    ctx: WorkspaceContext,
    query: {
      cursor?: string;
      limit?: number;
      projectSlug?: string;
      action?: ActivityAction;
    },
  ): Promise<ActivityFeedResult> {
    const limit = Math.min(Math.max(query.limit ?? 30, 1), 100);
    let projectId: string | undefined;

    if (query.projectSlug) {
      const project = await this.prisma.project.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          slug: query.projectSlug,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!project) {
        return { items: [], nextCursor: null };
      }
      projectId = project.id;
    }

    const cursorFilter = this.decodeCursor(query.cursor);

    const where: Prisma.ActivityLogWhereInput = {
      workspaceId: ctx.workspaceId,
      ...(projectId ? { projectId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(cursorFilter
        ? {
            OR: [
              { createdAt: { lt: cursorFilter.createdAt } },
              {
                createdAt: cursorFilter.createdAt,
                id: { lt: cursorFilter.id },
              },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.activityLog.findMany({
      where,
      include: {
        actor: {
          select: { id: true, name: true, avatarUrl: true },
        },
        project: {
          select: { id: true, name: true, slug: true },
        },
        task: {
          select: { id: true, title: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    return {
      items: page.map((row) => this.toItem(row)),
      nextCursor:
        hasMore && last
          ? this.encodeCursor(last.createdAt, last.id)
          : null,
    };
  }

  private toItem(row: {
    id: string;
    action: ActivityAction;
    createdAt: Date;
    metadata: Prisma.JsonValue | null;
    actor: { id: string; name: string; avatarUrl: string | null };
    project: { id: string; name: string; slug: string } | null;
    task: { id: string; title: string } | null;
  }): ActivityItem {
    return {
      id: row.id,
      action: row.action,
      createdAt: row.createdAt.toISOString(),
      metadata: row.metadata,
      actor: row.actor,
      project: row.project,
      task: row.task,
    };
  }

  private encodeCursor(createdAt: Date, id: string): string {
    return Buffer.from(
      `${createdAt.toISOString()}|${id}`,
      'utf8',
    ).toString('base64url');
  }

  private decodeCursor(
    cursor?: string,
  ): { createdAt: Date; id: string } | null {
    if (!cursor) return null;
    try {
      const raw = Buffer.from(cursor, 'base64url').toString('utf8');
      const [iso, id] = raw.split('|');
      if (!iso || !id) return null;
      const createdAt = new Date(iso);
      if (Number.isNaN(createdAt.getTime())) return null;
      return { createdAt, id };
    } catch {
      return null;
    }
  }
}
