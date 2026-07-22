import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType, Webhook } from '@prisma/client';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateWebhookDto, UpdateWebhookDto } from '../dto/integrations.dto';

export type WebhookDto = {
  id: string;
  workspaceId: string;
  url: string;
  hasSecret: boolean;
  events: string[];
  isActive: boolean;
  createdById: string;
  lastFiredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Map in-app notification types to webhook event names. */
export const NOTIFICATION_TYPE_TO_WEBHOOK_EVENT: Partial<
  Record<NotificationType, string>
> = {
  TASK_ASSIGNED: 'task.assigned',
  TASK_UPDATED: 'task.updated',
  COMMENT_ADDED: 'comment.added',
  MENTION: 'mention',
  COMPLETED: 'task.completed',
  DUE_SOON: 'task.due_soon',
  INVITATION: 'invitation',
  ROLE_CHANGED: 'role.changed',
  WORKSPACE_INVITE: 'workspace.invite',
};

function toWebhookDto(row: Webhook): WebhookDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    url: row.url,
    hasSecret: !!row.secret,
    events: row.events,
    isActive: row.isActive,
    createdById: row.createdById,
    lastFiredAt: row.lastFiredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(ctx: WorkspaceContext): Promise<WebhookDto[]> {
    const rows = await this.prisma.webhook.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toWebhookDto);
  }

  async create(
    ctx: WorkspaceContext,
    actorId: string,
    dto: CreateWebhookDto,
  ): Promise<WebhookDto> {
    const row = await this.prisma.webhook.create({
      data: {
        workspaceId: ctx.workspaceId,
        url: dto.url.trim(),
        secret: dto.secret?.trim() || null,
        events: dto.events.map((e) => e.trim()).filter(Boolean),
        createdById: actorId,
      },
    });
    return toWebhookDto(row);
  }

  async update(
    ctx: WorkspaceContext,
    webhookId: string,
    dto: UpdateWebhookDto,
  ): Promise<WebhookDto> {
    await this.requireWebhook(ctx, webhookId);
    const row = await this.prisma.webhook.update({
      where: { id: webhookId },
      data: {
        ...(dto.url !== undefined ? { url: dto.url.trim() } : {}),
        ...(dto.secret !== undefined
          ? { secret: dto.secret?.trim() || null }
          : {}),
        ...(dto.events !== undefined
          ? { events: dto.events.map((e) => e.trim()).filter(Boolean) }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return toWebhookDto(row);
  }

  async remove(
    ctx: WorkspaceContext,
    webhookId: string,
  ): Promise<{ message: string }> {
    await this.requireWebhook(ctx, webhookId);
    await this.prisma.webhook.delete({ where: { id: webhookId } });
    return { message: 'Webhook deleted' };
  }

  /**
   * Fire matching active webhooks asynchronously (never blocks the caller).
   */
  dispatch(
    workspaceId: string,
    workspaceSlug: string | undefined,
    event: string,
    data: unknown,
  ): void {
    void this.fireMatching(workspaceId, workspaceSlug, event, data).catch(
      (err: unknown) => {
        this.logger.warn(
          `Webhook dispatch failed for ${event}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      },
    );
  }

  dispatchFromNotification(
    workspaceId: string | undefined,
    workspaceSlug: string | undefined,
    type: NotificationType,
    data: unknown,
  ): void {
    if (!workspaceId) return;
    const event = NOTIFICATION_TYPE_TO_WEBHOOK_EVENT[type];
    if (!event) return;
    this.dispatch(workspaceId, workspaceSlug, event, data);
  }

  private async fireMatching(
    workspaceId: string,
    workspaceSlug: string | undefined,
    event: string,
    data: unknown,
  ): Promise<void> {
    const hooks = await this.prisma.webhook.findMany({
      where: {
        workspaceId,
        isActive: true,
        events: { has: event },
      },
    });
    if (hooks.length === 0) return;

    const body = JSON.stringify({
      event,
      workspaceSlug: workspaceSlug ?? null,
      data: data ?? null,
    });

    await Promise.allSettled(
      hooks.map(async (hook) => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'FlowPilot-Webhooks/1.0',
          'X-FlowPilot-Event': event,
        };
        if (hook.secret) {
          headers['X-FlowPilot-Secret'] = hook.secret;
        }

        const res = await fetch(hook.url, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) {
          this.logger.warn(
            `Webhook ${hook.id} responded ${res.status} for ${event}`,
          );
        }

        await this.prisma.webhook.update({
          where: { id: hook.id },
          data: { lastFiredAt: new Date() },
        });
      }),
    );
  }

  private async requireWebhook(
    ctx: WorkspaceContext,
    webhookId: string,
  ): Promise<Webhook> {
    const row = await this.prisma.webhook.findFirst({
      where: { id: webhookId, workspaceId: ctx.workspaceId },
    });
    if (!row) {
      throw new NotFoundException('Webhook not found');
    }
    return row;
  }
}
