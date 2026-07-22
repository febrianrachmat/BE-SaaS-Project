import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationType, TaskStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationService } from '../collab/services/notification.service';

const DUE_SOON_HOURS = 48;

@Injectable()
export class DueSoonJobService {
  private readonly logger = new Logger(DueSoonJobService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleDueSoonReminders() {
    if (this.running) return;
    this.running = true;

    try {
      const now = new Date();
      const until = new Date(now.getTime() + DUE_SOON_HOURS * 60 * 60 * 1000);
      const dedupeSince = new Date(now.getTime() - 20 * 60 * 60 * 1000);

      const tasks = await this.prisma.task.findMany({
        where: {
          deletedAt: null,
          assigneeId: { not: null },
          dueDate: { gte: now, lte: until },
          status: {
            notIn: [TaskStatus.DONE, TaskStatus.CANCELED],
          },
          project: {
            deletedAt: null,
            workspace: { deletedAt: null, archivedAt: null },
          },
        },
        include: {
          project: {
            select: {
              id: true,
              slug: true,
              name: true,
              workspaceId: true,
              workspace: { select: { slug: true } },
            },
          },
        },
        take: 200,
      });

      let sent = 0;
      const assigneeIds = [
        ...new Set(
          tasks
            .map((t) => t.assigneeId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      const recent = assigneeIds.length
        ? await this.prisma.notification.findMany({
            where: {
              type: NotificationType.DUE_SOON,
              createdAt: { gte: dedupeSince },
              userId: { in: assigneeIds },
            },
            select: { data: true },
          })
        : [];

      const alreadyNotified = new Set(
        recent
          .map((n) => {
            const data = n.data as { taskId?: string } | null;
            return data?.taskId;
          })
          .filter((id): id is string => Boolean(id)),
      );

      for (const task of tasks) {
        if (!task.assigneeId || !task.dueDate) continue;
        if (alreadyNotified.has(task.id)) continue;

        const dueLabel = task.dueDate.toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        });

        const ok = await this.notifications.notify({
          userId: task.assigneeId,
          workspaceId: task.project.workspaceId,
          workspaceSlug: task.project.workspace.slug,
          type: NotificationType.DUE_SOON,
          title: 'Task due soon',
          body: `"${task.title}" is due ${dueLabel}`,
          data: {
            taskId: task.id,
            projectId: task.project.id,
            projectSlug: task.project.slug,
            dueDate: task.dueDate.toISOString(),
          },
          prefKey: 'dueSoon',
        });
        if (ok) {
          sent += 1;
          alreadyNotified.add(task.id);
        }
      }

      if (sent > 0) {
        this.logger.log(`Sent ${sent} due-soon reminder(s)`);
      }
    } catch (err) {
      this.logger.error('Due-soon job failed', err instanceof Error ? err.stack : err);
    } finally {
      this.running = false;
    }
  }
}
