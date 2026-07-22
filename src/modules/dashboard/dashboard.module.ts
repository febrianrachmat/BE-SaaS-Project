import { Module } from '@nestjs/common';
import { DashboardController } from './controllers/dashboard.controller';
import { ActivityController } from './controllers/activity.controller';
import { DashboardService } from './services/dashboard.service';
import { ActivityService } from './services/activity.service';

@Module({
  controllers: [DashboardController, ActivityController],
  providers: [DashboardService, ActivityService],
})
export class DashboardModule {}
