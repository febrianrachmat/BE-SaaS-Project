import { Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { MailService } from '../../auth/services/mail.service';
import {
  NotificationPrefsDto,
  NotificationPrefsService,
} from '../../auth/services/notification-prefs.service';
import { WebhookService } from '../../integrations/services/webhook.service';

export type NotifyPrefKey = keyof Pick<
  NotificationPrefsDto,
  | 'taskAssigned'
  | 'taskUpdated'
  | 'commentAdded'
  | 'mention'
  | 'invitation'
  | 'dueSoon'
  | 'completed'
>;

export type NotifyInput = {
  userId: string;
  workspaceId?: string;
  workspaceSlug?: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Prisma.InputJsonValue;
  /** When set, also requires this preference flag. */
  prefKey?: NotifyPrefKey;
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly prefs: NotificationPrefsService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    @Optional() @Inject(WebhookService)
    private readonly webhooks?: WebhookService,
  ) {}

  async notifyMany(
    userIds: string[],
    input: Omit<NotifyInput, 'userId'>,
  ): Promise<void> {
    const unique = [...new Set(userIds)];
    // Fire workspace webhooks once per batch, not per recipient.
    this.webhooks?.dispatchFromNotification(
      input.workspaceId,
      input.workspaceSlug,
      input.type,
      {
        title: input.title,
        body: input.body,
        data: input.data ?? null,
        userIds: unique,
      },
    );
    for (const userId of unique) {
      await this.notify({ ...input, userId }, { skipWebhook: true });
    }
  }

  async notify(
    input: NotifyInput,
    options?: { skipWebhook?: boolean },
  ): Promise<boolean> {
    const prefs = await this.prefs.getOrCreate(input.userId);
    const prefAllowed = !input.prefKey || !!prefs[input.prefKey];
    const wantInApp = prefAllowed && prefs.inAppEnabled;
    const wantEmail = prefAllowed && prefs.emailEnabled;

    let delivered = false;

    if (wantInApp) {
      await this.prisma.notification.create({
        data: {
          userId: input.userId,
          workspaceId: input.workspaceId,
          type: input.type,
          title: input.title,
          body: input.body,
          data: input.data ?? undefined,
        },
      });

      this.realtime.emitNotificationNew({
        userId: input.userId,
        workspaceSlug: input.workspaceSlug,
      });
      delivered = true;
    }

    if (wantEmail) {
      const emailed = await this.sendEmailNotification(input);
      delivered = delivered || emailed;
    }

    if (!options?.skipWebhook) {
      this.webhooks?.dispatchFromNotification(
        input.workspaceId,
        input.workspaceSlug,
        input.type,
        {
          title: input.title,
          body: input.body,
          data: input.data ?? null,
          userId: input.userId,
        },
      );
    }

    return delivered;
  }

  async list(userId: string, unreadOnly = false) {
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      data: n.data,
      workspaceId: n.workspaceId,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  async markRead(userId: string, notificationId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!existing) throw new NotFoundException('Notification not found');

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    return {
      id: updated.id,
      readAt: updated.readAt?.toISOString() ?? null,
    };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { message: 'All notifications marked as read' };
  }

  private async sendEmailNotification(input: NotifyInput): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true, name: true },
      });
      if (!user?.email) return false;

      const actionUrl = this.buildActionUrl(input);
      await this.mail.sendNotificationEmail({
        to: user.email,
        subject: `FlowPilot: ${input.title}`,
        title: input.title,
        body: input.body,
        actionUrl,
        actionLabel: 'Open in FlowPilot',
      });
      return true;
    } catch (err) {
      this.logger.warn(
        `Failed to email notification to ${input.userId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }

  private buildActionUrl(input: NotifyInput): string | undefined {
    const frontend = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const data =
      input.data && typeof input.data === 'object' && !Array.isArray(input.data)
        ? (input.data as Record<string, unknown>)
        : null;
    const projectSlug =
      typeof data?.projectSlug === 'string' ? data.projectSlug : null;
    const taskId = typeof data?.taskId === 'string' ? data.taskId : null;

    if (input.workspaceSlug && projectSlug && taskId) {
      return `${frontend}/app/w/${input.workspaceSlug}/projects/${projectSlug}?task=${taskId}`;
    }
    if (input.workspaceSlug && projectSlug) {
      return `${frontend}/app/w/${input.workspaceSlug}/projects/${projectSlug}`;
    }
    if (input.workspaceSlug) {
      return `${frontend}/app/w/${input.workspaceSlug}`;
    }
    return `${frontend}/app`;
  }
}
