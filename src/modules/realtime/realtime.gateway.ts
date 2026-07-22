import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
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
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly realtime: RealtimeService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
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

  @SubscribeMessage('workspace:join')
  handleJoinWorkspace(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { slug?: string },
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
}
