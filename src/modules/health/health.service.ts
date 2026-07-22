import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MailService } from '../auth/services/mail.service';
import { OBJECT_STORAGE } from '../../infrastructure/storage/storage.module';
import type { ObjectStorage } from '../../infrastructure/storage/storage.types';

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  live() {
    return {
      status: 'ok',
      service: 'flowpilot-api',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      mailConfigured: this.mail.isConfigured(),
      storageDriver: this.storage.driver,
      timestamp: new Date().toISOString(),
    };
  }

  async ready() {
    const checks: Record<string, 'up' | 'down'> = {
      database: 'down',
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'up';
    } catch {
      checks.database = 'down';
    }

    const ready = Object.values(checks).every((v) => v === 'up');
    const payload = {
      status: ready ? 'ready' : 'not_ready',
      service: 'flowpilot-api',
      checks,
      storageDriver: this.storage.driver,
      mailConfigured: this.mail.isConfigured(),
      timestamp: new Date().toISOString(),
    };

    if (!ready) {
      throw new ServiceUnavailableException({
        message: 'Service not ready',
        checks,
      });
    }

    return payload;
  }
}
