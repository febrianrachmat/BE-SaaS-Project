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

@Injectable()
export class RealtimeService {
  private server: Server | null = null;

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
}
