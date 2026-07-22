import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import * as express from 'express';
import { createReadStream, existsSync } from 'fs';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { CurrentWorkspace } from '../../../common/decorators/current-workspace.decorator';
import type { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/rbac';
import {
  CreateCommentDto,
  SearchQueryDto,
  UpdateCommentDto,
} from '../dto/collab.dto';
import { CommentService } from '../services/comment.service';
import { SearchService } from '../services/search.service';
import { AttachmentService } from '../services/attachment.service';

@ApiTags('collab')
@ApiBearerAuth()
@ApiCookieAuth('access_token')
@Controller('workspaces/:slug')
export class CollabWorkspaceController {
  constructor(
    private readonly comments: CommentService,
    private readonly search: SearchService,
    private readonly attachments: AttachmentService,
  ) {}

  @Get('search')
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  @ApiOperation({ summary: 'Global workspace search' })
  searchWorkspace(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Query() query: SearchQueryDto,
  ) {
    return this.search.search(ctx, query);
  }

  @Get('projects/:projectSlug/tasks/:taskId/comments')
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  listComments(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Param('taskId') taskId: string,
  ) {
    return this.comments.list(ctx, projectSlug, taskId, user.id);
  }

  @Post('projects/:projectSlug/tasks/:taskId/comments')
  @RequirePermissions(PERMISSIONS.COMMENT_CREATE)
  createComment(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(ctx, projectSlug, taskId, user.id, dto);
  }

  @Patch('projects/:projectSlug/tasks/:taskId/comments/:commentId')
  @RequirePermissions(PERMISSIONS.COMMENT_CREATE)
  updateComment(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.comments.update(
      ctx,
      projectSlug,
      taskId,
      commentId,
      user.id,
      dto,
    );
  }

  @Delete('projects/:projectSlug/tasks/:taskId/comments/:commentId')
  @RequirePermissions(PERMISSIONS.COMMENT_CREATE)
  deleteComment(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.comments.remove(ctx, projectSlug, taskId, commentId, user.id);
  }

  @Get('projects/:projectSlug/tasks/:taskId/attachments')
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  listAttachments(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Param('taskId') taskId: string,
  ) {
    return this.attachments.list(ctx, projectSlug, taskId, user.id);
  }

  @Post('projects/:projectSlug/tasks/:taskId/attachments')
  @RequirePermissions(PERMISSIONS.FILE_UPLOAD)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadAttachment(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Param('taskId') taskId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.attachments.upload(ctx, projectSlug, taskId, user.id, file);
  }

  @Get('projects/:projectSlug/tasks/:taskId/attachments/:attachmentId/download')
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  async downloadAttachment(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Param('taskId') taskId: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: express.Response,
  ) {
    const resolved = await this.attachments.resolveDownload(
      ctx,
      projectSlug,
      taskId,
      attachmentId,
      user.id,
    );

    if (resolved.mode === 'redirect') {
      res.redirect(302, resolved.url);
      return;
    }

    if (!existsSync(resolved.path)) {
      res.status(404).json({
        success: false,
        data: null,
        meta: null,
        error: { code: 'NOT_FOUND', message: 'File missing on disk' },
      });
      return;
    }

    res.setHeader('Content-Type', resolved.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${resolved.fileName}"`,
    );
    createReadStream(resolved.path).pipe(res);
  }

  @Delete('projects/:projectSlug/tasks/:taskId/attachments/:attachmentId')
  @RequirePermissions(PERMISSIONS.FILE_DELETE)
  deleteAttachment(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Param('taskId') taskId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.attachments.remove(
      ctx,
      projectSlug,
      taskId,
      attachmentId,
      user.id,
    );
  }
}
