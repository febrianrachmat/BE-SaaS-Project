import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { NotificationController } from '../collab/controllers/notification.controller';
import { NotificationService } from '../collab/services/notification.service';
import { DueSoonJobService } from './due-soon-job.service';

/**
 * Standalone notification module so Project/Workspace can emit without
 * circular imports through CollabModule.
 */
@Module({
  imports: [RealtimeModule, AuthModule, forwardRef(() => IntegrationsModule)],
  controllers: [NotificationController],
  providers: [NotificationService, DueSoonJobService],
  exports: [NotificationService],
})
export class NotificationModule {}
