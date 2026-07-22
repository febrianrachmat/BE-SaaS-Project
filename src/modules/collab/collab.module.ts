import { Module } from '@nestjs/common';
import { ProjectModule } from '../project/project.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationModule } from '../notification/notification.module';
import { CollabWorkspaceController } from './controllers/collab-workspace.controller';
import { CommentService } from './services/comment.service';
import { SearchService } from './services/search.service';
import { AttachmentService } from './services/attachment.service';

@Module({
  imports: [ProjectModule, RealtimeModule, NotificationModule],
  controllers: [CollabWorkspaceController],
  providers: [CommentService, SearchService, AttachmentService],
})
export class CollabModule {}
