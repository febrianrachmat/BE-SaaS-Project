import { Module } from '@nestjs/common';
import { ProjectModule } from '../project/project.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CollabWorkspaceController } from './controllers/collab-workspace.controller';
import { NotificationController } from './controllers/notification.controller';
import { CommentService } from './services/comment.service';
import { NotificationService } from './services/notification.service';
import { SearchService } from './services/search.service';
import { AttachmentService } from './services/attachment.service';

@Module({
  imports: [ProjectModule, RealtimeModule],
  controllers: [CollabWorkspaceController, NotificationController],
  providers: [
    CommentService,
    NotificationService,
    SearchService,
    AttachmentService,
  ],
})
export class CollabModule {}
