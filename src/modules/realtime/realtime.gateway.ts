import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RealtimeService } from './realtime.service';
import type { AccessTokenPayload } from '../auth/services/token.service';

function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((part) => {
      const [k, ...rest] = part.trim().split('=');
      return [k, decodeURIComponent(rest.join('=') || '')];
    }),
  );
}

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly realtime: RealtimeService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.setServer(server);
    this.logger.log('Realtime gateway ready (/realtime)');
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const cookies = parseCookies(client.handshake.headers.cookie);
      const token =
        cookies.access_token ||
        (client.handshake.auth?.token as string | undefined) ||
        (typeof client.handshake.query.token === 'string'
          ? client.handshake.query.token
          : undefined);

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      client.data.userId = payload.sub;
      await client.join(`user:${payload.sub}`);
    } catch (error) {
      this.logger.warn(
        `Realtime auth failed: ${(error as Error).message}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const entry = this.realtime.removePresence(client.id);
    if (entry) {
      this.realtime.emitPresenceUpdate(entry.workspaceSlug);
    }
  }

  @SubscribeMessage('workspace:join')
  handleJoinWorkspace(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { slug?: string; projectSlug?: string },
  ): { ok: boolean } {
    const slug = body?.slug?.trim();
    if (!slug || !client.data.userId) {
      return { ok: false };
    }
    void client.join(`workspace:${slug}`);
    return { ok: true };
  }

  @SubscribeMessage('workspace:leave')
  handleLeaveWorkspace(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { slug?: string },
  ): { ok: boolean } {
    const slug = body?.slug?.trim();
    if (!slug) return { ok: false };
    void client.leave(`workspace:${slug}`);
    return { ok: true };
  }

  @SubscribeMessage('presence:join')
  async handlePresenceJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: { workspaceSlug?: string; projectSlug?: string },
  ): Promise<{ ok: boolean }> {
    const workspaceSlug = body?.workspaceSlug?.trim();
    const userId = client.data.userId as string | undefined;
    if (!workspaceSlug || !userId) {
      return { ok: false };
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, name: true, avatarUrl: true },
    });
    if (!user) {
      return { ok: false };
    }

    const previous = this.realtime.getPresence(client.id);
    if (previous && previous.workspaceSlug !== workspaceSlug) {
      this.realtime.removePresence(client.id);
      this.realtime.emitPresenceUpdate(previous.workspaceSlug);
    }

    const projectSlug = body?.projectSlug?.trim() || undefined;

    await client.join(`workspace:${workspaceSlug}`);
    this.realtime.setPresence(client.id, {
      userId,
      name: user.name,
      avatarUrl: user.avatarUrl,
      workspaceSlug,
      projectSlug,
    });
    this.realtime.emitPresenceUpdate(workspaceSlug);
    return { ok: true };
  }

  @SubscribeMessage('presence:leave')
  handlePresenceLeave(
    @ConnectedSocket() client: Socket,
  ): { ok: boolean } {
    const entry = this.realtime.removePresence(client.id);
    if (entry) {
      this.realtime.emitPresenceUpdate(entry.workspaceSlug);
    }
    return { ok: true };
  }

  /** Optional keepalive — presence is primarily driven by join/leave/disconnect. */
  @SubscribeMessage('presence:heartbeat')
  handlePresenceHeartbeat(
    @ConnectedSocket() client: Socket,
  ): { ok: boolean } {
    return { ok: Boolean(this.realtime.getPresence(client.id)) };
  }
}
