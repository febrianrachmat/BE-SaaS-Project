import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { ProjectService } from '../../project/services/project.service';
import { CreateCommentDto, UpdateCommentDto } from '../dto/collab.dto';
import { RealtimeService } from '../../realtime/realtime.service';
import { NotificationService } from './notification.service';

const MENTION_REGEX = /@([a-zA-Z0-9._-]+)/g;

@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationService,
  ) {}

  async list(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
    userId: string,
  ) {
    await this.requireTask(ctx, projectSlug, taskId, userId);
    const comments = await this.prisma.comment.findMany({
      where: { taskId, deletedAt: null },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      author: c.author,
    }));
  }

  async create(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
    actorId: string,
    dto: CreateCommentDto,
  ) {
    const task = await this.requireTask(ctx, projectSlug, taskId, actorId);
    const comment = await this.prisma.comment.create({
      data: {
        taskId,
        authorId: actorId,
        body: dto.body.trim(),
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    await this.prisma.activityLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        projectId: task.projectId,
        taskId,
        actorId,
        action: 'COMMENT_ADDED',
        metadata: { commentId: comment.id },
      },
    });

    // Notify assignee (if not author)
    if (task.assigneeId && task.assigneeId !== actorId) {
      await this.notifications.notify({
        userId: task.assigneeId,
        workspaceId: ctx.workspaceId,
        workspaceSlug: ctx.slug,
        type: NotificationType.COMMENT_ADDED,
        title: 'New comment on your task',
        body: `${comment.author.name} commented on "${task.title}"`,
        data: {
          taskId,
          projectId: task.projectId,
          projectSlug,
          commentId: comment.id,
        },
        prefKey: 'commentAdded',
      });
    }

    // Mention notifications by email local-part or name token
    const mentions = [...dto.body.matchAll(MENTION_REGEX)].map((m) =>
      m[1].toLowerCase(),
    );
    if (mentions.length) {
      const members = await this.prisma.workspaceMember.findMany({
        where: { workspaceId: ctx.workspaceId, deletedAt: null },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      const mentionedUsers = members
        .map((m) => m.user)
        .filter((u) => {
          const emailLocal = u.email.split('@')[0].toLowerCase();
          const nameToken = u.name.split(/\s+/)[0].toLowerCase();
          return (
            mentions.includes(emailLocal) ||
            mentions.includes(nameToken) ||
            mentions.includes(u.name.toLowerCase().replace(/\s+/g, ''))
          );
        })
        .filter((u) => u.id !== actorId);

      for (const u of mentionedUsers) {
        await this.notifications.notify({
          userId: u.id,
          workspaceId: ctx.workspaceId,
          workspaceSlug: ctx.slug,
          type: NotificationType.MENTION,
          title: 'You were mentioned',
          body: `${comment.author.name} mentioned you on "${task.title}"`,
          data: {
            taskId,
            projectId: task.projectId,
            projectSlug,
            commentId: comment.id,
          },
          prefKey: 'mention',
        });
      }
    }

    this.realtime.emitTaskChanged({
      workspaceSlug: ctx.slug,
      projectSlug,
      taskId,
      action: 'updated',
    });

    return {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      author: comment.author,
    };
  }

  async update(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
    commentId: string,
    actorId: string,
    dto: UpdateCommentDto,
  ) {
    await this.requireTask(ctx, projectSlug, taskId, actorId);
    const existing = await this.prisma.comment.findFirst({
      where: { id: commentId, taskId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Comment not found');
    if (existing.authorId !== actorId) {
      throw new NotFoundException('Comment not found');
    }

    const comment = await this.prisma.comment.update({
      where: { id: commentId },
      data: { body: dto.body.trim() },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    return {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      author: comment.author,
    };
  }

  async remove(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
    commentId: string,
    actorId: string,
  ) {
    await this.requireTask(ctx, projectSlug, taskId, actorId);
    const existing = await this.prisma.comment.findFirst({
      where: { id: commentId, taskId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Comment not found');
    if (existing.authorId !== actorId) {
      throw new NotFoundException('Comment not found');
    }

    await this.prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Comment deleted' };
  }

  private async requireTask(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
    userId: string,
  ) {
    const project = await this.projects.requireAccessibleProject(
      ctx,
      projectSlug,
      userId,
    );
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId: project.id, deletedAt: null },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }
}
