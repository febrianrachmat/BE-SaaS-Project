import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { MailService } from '../auth/services/mail.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly mail: MailService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check' })
  check() {
    return {
      status: 'ok',
      service: 'flowpilot-api',
      mailConfigured: this.mail.isConfigured(),
      timestamp: new Date().toISOString(),
    };
  }
}
