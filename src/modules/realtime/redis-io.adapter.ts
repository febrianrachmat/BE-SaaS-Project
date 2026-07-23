import { INestApplication, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, type RedisClientType } from 'redis';
import type { ServerOptions } from 'socket.io';

/**
 * Uses Redis pub/sub for Socket.IO when REDIS_URL is set.
 * Falls back to the default in-memory adapter otherwise.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor:
    | ReturnType<typeof createAdapter>
    | null = null;
  private pubClient: RedisClientType | null = null;
  private subClient: RedisClientType | null = null;

  constructor(private readonly app: INestApplication) {
    super(app);
  }

  async connectToRedis(redisUrl: string): Promise<void> {
    this.pubClient = createClient({ url: redisUrl });
    this.subClient = this.pubClient.duplicate();

    this.pubClient.on('error', (err) =>
      this.logger.error(`Redis pub error: ${err.message}`),
    );
    this.subClient.on('error', (err) =>
      this.logger.error(`Redis sub error: ${err.message}`),
    );

    await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
    this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
    this.logger.log('Socket.IO Redis adapter connected');
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }

  async close(): Promise<void> {
    await Promise.allSettled([
      this.pubClient?.quit(),
      this.subClient?.quit(),
    ]);
  }
}
