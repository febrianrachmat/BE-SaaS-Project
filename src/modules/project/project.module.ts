import { Module } from '@nestjs/common';
import { ProjectController } from './controllers/project.controller';
import { ShareController } from './controllers/share.controller';
import { ProjectRepository } from './repositories/project.repository';
import { TaskRepository } from './repositories/task.repository';
import { ProjectService } from './services/project.service';
import { ShareLinkService } from './services/share-link.service';
import { TaskService } from './services/task.service';
import { ProjectExportService } from './services/project-export.service';
import { TrashService } from './services/trash.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [RealtimeModule, NotificationModule],
  controllers: [ProjectController, ShareController],
  providers: [
    ProjectRepository,
    TaskRepository,
    ProjectService,
    TaskService,
    ShareLinkService,
    ProjectExportService,
    TrashService,
  ],
  exports: [ProjectService, TaskService],
})
export class ProjectModule {}
