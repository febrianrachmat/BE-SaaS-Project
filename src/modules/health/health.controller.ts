import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return this.health.live();
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (database)' })
  ready() {
    return this.health.ready();
  }
}
