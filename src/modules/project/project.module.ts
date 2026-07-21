import { Module } from '@nestjs/common';
import { ProjectController } from './controllers/project.controller';
import { ProjectRepository } from './repositories/project.repository';
import { TaskRepository } from './repositories/task.repository';
import { ProjectService } from './services/project.service';
import { TaskService } from './services/task.service';

@Module({
  controllers: [ProjectController],
  providers: [
    ProjectRepository,
    TaskRepository,
    ProjectService,
    TaskService,
  ],
  exports: [ProjectService, TaskService],
})
export class ProjectModule {}
