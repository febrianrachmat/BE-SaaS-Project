import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { ProjectModule } from './modules/project/project.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CycleModule } from './modules/cycle/cycle.module';
import { TemplateModule } from './modules/template/template.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { CollabModule } from './modules/collab/collab.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL ?? 60) * 1000,
        limit: Number(process.env.THROTTLE_LIMIT ?? 100),
      },
    ]),
    PrismaModule,
    StorageModule,
    HealthModule,
    AuthModule,
    WorkspaceModule,
    ProjectModule,
    DashboardModule,
    CycleModule,
    TemplateModule,
    IntegrationsModule,
    CollabModule,
    NotificationModule,
    AdminModule,
    RealtimeModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
