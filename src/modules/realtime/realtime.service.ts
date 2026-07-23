import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';
import { Server } from 'socket.io';

export type TaskChangedPayload = {
  workspaceSlug: string;
  projectSlug: string;
  taskId: string;
  action: 'created' | 'updated' | 'moved' | 'deleted';
};

export type NotificationNewPayload = {
  userId: string;
  workspaceSlug?: string;
};

export type PresenceEntry = {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  workspaceSlug: string;
  projectSlug?: string;
};

export type PresenceUser = {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  projectSlug?: string;
};

const PRESENCE_TTL_SEC = 120;

@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server | null = null;
  /** socketId → presence metadata (local cache; Redis is source of truth when enabled) */
  private readonly presence = new Map<string, PresenceEntry>();
  private redis: RedisClientType | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.config.get<string>('REDIS_URL')?.trim();
    if (!redisUrl) return;

    try {
      this.redis = createClient({ url: redisUrl });
      this.redis.on('error', (err) =>
        this.logger.error(`Presence Redis error: ${err.message}`),
      );
      await this.redis.connect();
      this.logger.log('Presence Redis client connected');
    } catch (err) {
      this.logger.warn(
        `Presence Redis unavailable, using in-memory only: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      this.redis = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
      this.redis = null;
    }
  }

  setServer(server: Server): void {
    this.server = server;
  }

  emitTaskChanged(payload: TaskChangedPayload): void {
    this.server
      ?.to(`workspace:${payload.workspaceSlug}`)
      .emit('task:changed', payload);
  }

  emitNotificationNew(payload: NotificationNewPayload): void {
    this.server
      ?.to(`user:${payload.userId}`)
      .emit('notification:new', payload);
  }

  async setPresence(socketId: string, entry: PresenceEntry): Promise<void> {
    this.presence.set(socketId, entry);
    if (!this.redis) return;

    const key = this.workspaceKey(entry.workspaceSlug);
    const sockKey = this.socketKey(socketId);
    await this.redis
      .multi()
      .hSet(key, socketId, JSON.stringify(entry))
      .expire(key, PRESENCE_TTL_SEC)
      .set(sockKey, entry.workspaceSlug, { EX: PRESENCE_TTL_SEC })
      .exec();
  }

  getPresence(socketId: string): PresenceEntry | undefined {
    return this.presence.get(socketId);
  }

  async removePresence(socketId: string): Promise<PresenceEntry | undefined> {
    let entry = this.presence.get(socketId);
    this.presence.delete(socketId);

    if (this.redis) {
      const sockKey = this.socketKey(socketId);
      const workspaceSlug =
        entry?.workspaceSlug ?? (await this.redis.get(sockKey));
      if (workspaceSlug) {
        if (!entry) {
          const raw = await this.redis.hGet(
            this.workspaceKey(workspaceSlug),
            socketId,
          );
          if (raw) {
            try {
              entry = JSON.parse(raw) as PresenceEntry;
            } catch {
              entry = undefined;
            }
          }
        }
        await this.redis
          .multi()
          .hDel(this.workspaceKey(workspaceSlug), socketId)
          .del(sockKey)
          .exec();
      }
    }

    return entry;
  }

  async touchPresence(socketId: string): Promise<boolean> {
    const entry = this.presence.get(socketId);
    if (!entry) return false;
    if (this.redis) {
      await this.redis
        .multi()
        .expire(this.workspaceKey(entry.workspaceSlug), PRESENCE_TTL_SEC)
        .expire(this.socketKey(socketId), PRESENCE_TTL_SEC)
        .exec();
    }
    return true;
  }

  /** Online users in a workspace room, deduped by userId (last socket wins). */
  async getOnlineUsers(workspaceSlug: string): Promise<PresenceUser[]> {
    const byUser = new Map<string, PresenceUser>();

    if (this.redis) {
      const all = await this.redis.hGetAll(this.workspaceKey(workspaceSlug));
      for (const raw of Object.values(all)) {
        try {
          const entry = JSON.parse(raw) as PresenceEntry;
          byUser.set(entry.userId, {
            userId: entry.userId,
            name: entry.name,
            avatarUrl: entry.avatarUrl ?? null,
            projectSlug: entry.projectSlug,
          });
        } catch {
          // ignore malformed
        }
      }
      return [...byUser.values()];
    }

    for (const entry of this.presence.values()) {
      if (entry.workspaceSlug !== workspaceSlug) continue;
      byUser.set(entry.userId, {
        userId: entry.userId,
        name: entry.name,
        avatarUrl: entry.avatarUrl ?? null,
        projectSlug: entry.projectSlug,
      });
    }
    return [...byUser.values()];
  }

  async emitPresenceUpdate(workspaceSlug: string): Promise<void> {
    const users = await this.getOnlineUsers(workspaceSlug);
    this.server
      ?.to(`workspace:${workspaceSlug}`)
      .emit('presence:update', users);
  }

  private workspaceKey(workspaceSlug: string): string {
    return `fp:presence:${workspaceSlug}`;
  }

  private socketKey(socketId: string): string {
    return `fp:presence:sock:${socketId}`;
  }
}
