import { createHmac, timingSafeEqual } from 'crypto';
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

export type WebhookDeliveryDto = {
  id: string;
  webhookId: string;
  event: string;
  success: boolean;
  statusCode: number | null;
  attempt: number;
  responseSnippet: string | null;
  createdAt: string;
};

const SNIPPET_MAX = 280;

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

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [0, 500, 2000];

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

function signPayload(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

/** Exported for tests / receivers verifying signatures. */
export function verifyWebhookSignature(
  secret: string,
  body: string,
  signatureHeader: string,
): boolean {
  const expected = signPayload(secret, body);
  const provided = signatureHeader.replace(/^sha256=/, '');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
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

  async listDeliveries(
    ctx: WorkspaceContext,
    webhookId: string,
  ): Promise<WebhookDeliveryDto[]> {
    await this.requireWebhook(ctx, webhookId);
    const rows = await this.prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return rows.map((row) => ({
      id: row.id,
      webhookId: row.webhookId,
      event: row.event,
      success: row.success,
      statusCode: row.statusCode,
      attempt: row.attempt,
      responseSnippet: row.responseSnippet,
      createdAt: row.createdAt.toISOString(),
    }));
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

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({
      event,
      workspaceSlug: workspaceSlug ?? null,
      data: data ?? null,
      timestamp,
    });

    await Promise.allSettled(
      hooks.map((hook) => this.deliverWithRetry(hook, event, body, timestamp)),
    );
  }

  private async deliverWithRetry(
    hook: Webhook,
    event: string,
    body: string,
    timestamp: string,
  ): Promise<void> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const delay = BACKOFF_MS[attempt] ?? 0;
      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'FlowPilot-Webhooks/1.0',
          'X-FlowPilot-Event': event,
          'X-FlowPilot-Timestamp': timestamp,
          'X-FlowPilot-Delivery-Attempt': String(attempt + 1),
        };
        if (hook.secret) {
          const signature = signPayload(hook.secret, `${timestamp}.${body}`);
          headers['X-FlowPilot-Signature'] = `sha256=${signature}`;
        }

        const res = await fetch(hook.url, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(10_000),
        });
        const responseText = await res.text().catch(() => '');
        const snippet = this.truncateSnippet(responseText || res.statusText);

        await this.recordDelivery({
          webhookId: hook.id,
          event,
          success: res.ok,
          statusCode: res.status,
          attempt: attempt + 1,
          responseSnippet: snippet,
        });

        if (res.ok) {
          await this.prisma.webhook.update({
            where: { id: hook.id },
            data: { lastFiredAt: new Date() },
          });
          return;
        }

        this.logger.warn(
          `Webhook ${hook.id} responded ${res.status} for ${event} (attempt ${attempt + 1})`,
        );
        // Retry only on 5xx / 429
        if (res.status < 500 && res.status !== 429) {
          return;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Webhook ${hook.id} network error for ${event} (attempt ${attempt + 1}): ${message}`,
        );
        await this.recordDelivery({
          webhookId: hook.id,
          event,
          success: false,
          statusCode: null,
          attempt: attempt + 1,
          responseSnippet: this.truncateSnippet(message),
        });
      }
    }
  }

  private truncateSnippet(value: string): string {
    const cleaned = value.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= SNIPPET_MAX) return cleaned;
    return `${cleaned.slice(0, SNIPPET_MAX)}…`;
  }

  private async recordDelivery(input: {
    webhookId: string;
    event: string;
    success: boolean;
    statusCode: number | null;
    attempt: number;
    responseSnippet: string | null;
  }): Promise<void> {
    try {
      await this.prisma.webhookDelivery.create({
        data: {
          webhookId: input.webhookId,
          event: input.event,
          success: input.success,
          statusCode: input.statusCode,
          attempt: input.attempt,
          responseSnippet: input.responseSnippet,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to persist webhook delivery: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
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
