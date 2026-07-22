import { Injectable } from '@nestjs/common';
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

@Injectable()
export class RealtimeService {
  private server: Server | null = null;
  /** socketId → presence metadata */
  private readonly presence = new Map<string, PresenceEntry>();

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

  setPresence(socketId: string, entry: PresenceEntry): void {
    this.presence.set(socketId, entry);
  }

  getPresence(socketId: string): PresenceEntry | undefined {
    return this.presence.get(socketId);
  }

  removePresence(socketId: string): PresenceEntry | undefined {
    const entry = this.presence.get(socketId);
    this.presence.delete(socketId);
    return entry;
  }

  /** Online users in a workspace room, deduped by userId (last socket wins). */
  getOnlineUsers(workspaceSlug: string): PresenceUser[] {
    const byUser = new Map<string, PresenceUser>();
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

  emitPresenceUpdate(workspaceSlug: string): void {
    this.server
      ?.to(`workspace:${workspaceSlug}`)
      .emit('presence:update', this.getOnlineUsers(workspaceSlug));
  }
}
