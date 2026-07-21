import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';

export type DashboardOverview = {
  stats: {
    projects: number;
    activeProjects: number;
    tasks: number;
    completedTasks: number;
    members: number;
    overdueTasks: number;
  };
  tasksByStatus: Array<{ status: TaskStatus; count: number }>;
  tasksByPriority: Array<{ priority: string; count: number }>;
  weeklyCompletion: Array<{ date: string; completed: number; created: number }>;
  upcomingDeadlines: Array<{
    id: string;
    title: string;
    dueDate: string;
    status: TaskStatus;
    priority: string;
    project: { name: string; slug: string; icon: string | null };
  }>;
  assignedToMe: Array<{
    id: string;
    title: string;
    status: TaskStatus;
    priority: string;
    dueDate: string | null;
    project: { name: string; slug: string; icon: string | null };
  }>;
  projectProgress: Array<{
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    totalTasks: number;
    doneTasks: number;
    progress: number;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    createdAt: string;
    actor: { id: string; name: string; avatarUrl: string | null };
    metadata: unknown;
  }>;
  memberActivity: Array<{
    userId: string;
    name: string;
    avatarUrl: string | null;
    actions: number;
  }>;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(
    ctx: WorkspaceContext,
    userId: string,
  ): Promise<DashboardOverview> {
    const workspaceId = ctx.workspaceId;
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 6);
    weekAgo.setHours(0, 0, 0, 0);

    const upcomingLimit = new Date(now);
    upcomingLimit.setDate(upcomingLimit.getDate() + 14);

    const [
      projects,
      activeProjects,
      tasks,
      completedTasks,
      members,
      overdueTasks,
      statusGroups,
      priorityGroups,
      upcoming,
      assigned,
      projectRows,
      activities,
      memberActs,
      createdInWeek,
      completedInWeek,
    ] = await Promise.all([
      this.prisma.project.count({
        where: { workspaceId, deletedAt: null },
      }),
      this.prisma.project.count({
        where: {
          workspaceId,
          deletedAt: null,
          archivedAt: null,
          status: 'ACTIVE',
        },
      }),
      this.prisma.task.count({
        where: {
          deletedAt: null,
          project: { workspaceId, deletedAt: null },
        },
      }),
      this.prisma.task.count({
        where: {
          deletedAt: null,
          status: TaskStatus.DONE,
          project: { workspaceId, deletedAt: null },
        },
      }),
      this.prisma.workspaceMember.count({
        where: { workspaceId, deletedAt: null },
      }),
      this.prisma.task.count({
        where: {
          deletedAt: null,
          dueDate: { lt: now },
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELED] },
          project: { workspaceId, deletedAt: null },
        },
      }),
      this.prisma.task.groupBy({
        by: ['status'],
        where: {
          deletedAt: null,
          parentId: null,
          project: { workspaceId, deletedAt: null },
        },
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['priority'],
        where: {
          deletedAt: null,
          parentId: null,
          status: { not: TaskStatus.CANCELED },
          project: { workspaceId, deletedAt: null },
        },
        _count: { _all: true },
      }),
      this.prisma.task.findMany({
        where: {
          deletedAt: null,
          dueDate: { gte: now, lte: upcomingLimit },
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELED] },
          project: { workspaceId, deletedAt: null },
        },
        include: {
          project: { select: { name: true, slug: true, icon: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 8,
      }),
      this.prisma.task.findMany({
        where: {
          deletedAt: null,
          assigneeId: userId,
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELED] },
          project: { workspaceId, deletedAt: null },
        },
        include: {
          project: { select: { name: true, slug: true, icon: true } },
        },
        orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
        take: 8,
      }),
      this.prisma.project.findMany({
        where: { workspaceId, deletedAt: null, archivedAt: null },
        select: {
          id: true,
          name: true,
          slug: true,
          icon: true,
          tasks: {
            where: { deletedAt: null, parentId: null },
            select: { status: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      this.prisma.activityLog.findMany({
        where: { workspaceId },
        include: {
          actor: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      this.prisma.activityLog.groupBy({
        by: ['actorId'],
        where: {
          workspaceId,
          createdAt: { gte: weekAgo },
        },
        _count: { _all: true },
        orderBy: { _count: { actorId: 'desc' } },
        take: 6,
      }),
      this.prisma.task.findMany({
        where: {
          deletedAt: null,
          createdAt: { gte: weekAgo },
          project: { workspaceId, deletedAt: null },
        },
        select: { createdAt: true },
      }),
      this.prisma.task.findMany({
        where: {
          deletedAt: null,
          status: TaskStatus.DONE,
          completedAt: { gte: weekAgo },
          project: { workspaceId, deletedAt: null },
        },
        select: { completedAt: true },
      }),
    ]);

    const weeklyCompletion = this.buildWeeklySeries(
      weekAgo,
      createdInWeek,
      completedInWeek,
    );

    const actorIds = memberActs.map((m) => m.actorId);
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, avatarUrl: true },
        })
      : [];
    const actorMap = new Map(actors.map((a) => [a.id, a]));

    return {
      stats: {
        projects,
        activeProjects,
        tasks,
        completedTasks,
        members,
        overdueTasks,
      },
      tasksByStatus: statusGroups.map((g) => ({
        status: g.status,
        count: g._count._all,
      })),
      tasksByPriority: priorityGroups.map((g) => ({
        priority: g.priority,
        count: g._count._all,
      })),
      weeklyCompletion,
      upcomingDeadlines: upcoming.map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate!.toISOString(),
        status: t.status,
        priority: t.priority,
        project: t.project,
      })),
      assignedToMe: assigned.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate?.toISOString() ?? null,
        project: t.project,
      })),
      projectProgress: projectRows.map((p) => {
        const totalTasks = p.tasks.length;
        const doneTasks = p.tasks.filter((t) => t.status === TaskStatus.DONE)
          .length;
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          icon: p.icon,
          totalTasks,
          doneTasks,
          progress: totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100),
        };
      }),
      recentActivity: activities.map((a) => ({
        id: a.id,
        action: a.action,
        createdAt: a.createdAt.toISOString(),
        actor: a.actor,
        metadata: a.metadata,
      })),
      memberActivity: memberActs.map((m) => {
        const actor = actorMap.get(m.actorId);
        return {
          userId: m.actorId,
          name: actor?.name ?? 'Unknown',
          avatarUrl: actor?.avatarUrl ?? null,
          actions: m._count._all,
        };
      }),
    };
  }

  private buildWeeklySeries(
    weekAgo: Date,
    created: Array<{ createdAt: Date }>,
    completed: Array<{ completedAt: Date | null }>,
  ) {
    const days: Array<{ date: string; completed: number; created: number }> =
      [];

    for (let i = 0; i < 7; i += 1) {
      const d = new Date(weekAgo);
      d.setDate(weekAgo.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, completed: 0, created: 0 });
    }

    const index = new Map(days.map((d, i) => [d.date, i]));

    for (const row of created) {
      const key = row.createdAt.toISOString().slice(0, 10);
      const i = index.get(key);
      if (i !== undefined) days[i].created += 1;
    }

    for (const row of completed) {
      if (!row.completedAt) continue;
      const key = row.completedAt.toISOString().slice(0, 10);
      const i = index.get(key);
      if (i !== undefined) days[i].completed += 1;
    }

    return days;
  }
}
