import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { ProjectService } from '../../project/services/project.service';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

@Injectable()
export class AttachmentService {
  private readonly uploadRoot: string;
  private readonly maxBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectService,
    config: ConfigService,
  ) {
    this.uploadRoot = config.get<string>('STORAGE_LOCAL_PATH', './uploads');
    const maxMb = Number(config.get('MAX_FILE_SIZE_MB', 10));
    this.maxBytes = maxMb * 1024 * 1024;
    if (!existsSync(this.uploadRoot)) {
      mkdirSync(this.uploadRoot, { recursive: true });
    }
  }

  async list(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
  ) {
    await this.requireTask(ctx, projectSlug, taskId);
    const rows = await this.prisma.attachment.findMany({
      where: { taskId, deletedAt: null },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((a) => this.toDto(a));
  }

  async upload(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
    actorId: string,
    file: Express.Multer.File,
  ) {
    await this.requireTask(ctx, projectSlug, taskId);

    if (!file) throw new BadRequestException('File is required');
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }
    if (file.size > this.maxBytes) {
      throw new BadRequestException('File exceeds size limit');
    }

    const key = `${ctx.workspaceId}/${taskId}/${randomUUID()}-${file.originalname}`;
    const fullPath = join(this.uploadRoot, key);
    const dir = join(this.uploadRoot, ctx.workspaceId, taskId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    await pipeline(Readable.from(file.buffer), createWriteStream(fullPath));

    const attachment = await this.prisma.attachment.create({
      data: {
        taskId,
        uploadedById: actorId,
        fileName: file.originalname,
        fileKey: key,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await this.prisma.activityLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        taskId,
        actorId,
        action: 'FILE_UPLOADED',
        metadata: { fileName: file.originalname, attachmentId: attachment.id },
      },
    });

    return this.toDto(attachment);
  }

  async remove(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
    attachmentId: string,
    actorId: string,
  ) {
    await this.requireTask(ctx, projectSlug, taskId);
    const existing = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, taskId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Attachment not found');

    await this.prisma.attachment.update({
      where: { id: attachmentId },
      data: { deletedAt: new Date() },
    });

    const fullPath = join(this.uploadRoot, existing.fileKey);
    if (existsSync(fullPath)) {
      try {
        unlinkSync(fullPath);
      } catch {
        // ignore fs errors on soft delete
      }
    }

    await this.prisma.activityLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        taskId,
        actorId,
        action: 'FILE_DELETED',
        metadata: { attachmentId, fileName: existing.fileName },
      },
    });

    return { message: 'Attachment deleted' };
  }

  getAbsolutePath(fileKey: string) {
    return join(this.uploadRoot, fileKey);
  }

  async getForDownload(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
    attachmentId: string,
  ) {
    await this.requireTask(ctx, projectSlug, taskId);
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, taskId, deletedAt: null },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    return attachment;
  }

  private toDto(a: {
    id: string;
    fileName: string;
    fileKey: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
    uploadedBy: { id: string; name: string; email: string };
  }) {
    return {
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      createdAt: a.createdAt.toISOString(),
      uploadedBy: a.uploadedBy,
      isImage: a.mimeType.startsWith('image/'),
    };
  }

  private async requireTask(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
  ) {
    const project = await this.projects.requireProject(
      ctx.workspaceId,
      projectSlug,
    );
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId: project.id, deletedAt: null },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }
}
