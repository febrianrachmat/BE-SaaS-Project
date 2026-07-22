import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { MailService } from '../auth/services/mail.service';
import { OBJECT_STORAGE } from '../../infrastructure/storage/storage.module';
import type { ObjectStorage } from '../../infrastructure/storage/storage.types';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly mail: MailService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check' })
  check() {
    return {
      status: 'ok',
      service: 'flowpilot-api',
      mailConfigured: this.mail.isConfigured(),
      storageDriver: this.storage.driver,
      timestamp: new Date().toISOString(),
    };
  }
}
