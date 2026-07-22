import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { OBJECT_STORAGE } from '../../../infrastructure/storage/storage.module';
import type { ObjectStorage } from '../../../infrastructure/storage/storage.types';
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
  private readonly maxBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    config: ConfigService,
  ) {
    const maxMb = Number(config.get('MAX_FILE_SIZE_MB', 10));
    this.maxBytes = maxMb * 1024 * 1024;
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

    return Promise.all(rows.map((a) => this.toDto(a)));
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

    const safeName = this.sanitizeFileName(file.originalname);
    const key = `${ctx.workspaceId}/${taskId}/${randomUUID()}-${safeName}`;
    await this.storage.put(key, file.buffer, file.mimetype);

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

    await this.storage.delete(existing.fileKey);

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

  async resolveDownload(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
    attachmentId: string,
  ): Promise<
    | { mode: 'redirect'; url: string; fileName: string; mimeType: string }
    | {
        mode: 'stream';
        path: string;
        fileName: string;
        mimeType: string;
      }
  > {
    await this.requireTask(ctx, projectSlug, taskId);
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, taskId, deletedAt: null },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    const signed = await this.storage.getDownloadUrl(
      attachment.fileKey,
      attachment.fileName,
      3600,
    );
    if (signed) {
      return {
        mode: 'redirect',
        url: signed,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
      };
    }

    const path = this.storage.getLocalPath(attachment.fileKey);
    if (!path || !(await this.storage.exists(attachment.fileKey))) {
      throw new NotFoundException('File missing on storage');
    }

    return {
      mode: 'stream',
      path,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
    };
  }

  private async toDto(a: {
    id: string;
    fileName: string;
    fileKey: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
    uploadedBy: { id: string; name: string; email: string };
  }) {
    const url =
      this.storage.driver === 's3'
        ? await this.storage.getDownloadUrl(a.fileKey, a.fileName, 3600)
        : null;

    return {
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      createdAt: a.createdAt.toISOString(),
      uploadedBy: a.uploadedBy,
      isImage: a.mimeType.startsWith('image/'),
      url,
      storageDriver: this.storage.driver,
    };
  }

  private sanitizeFileName(name: string): string {
    return name.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 180);
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
