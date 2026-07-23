import {
  Injectable,
  NotFoundException,
  GoneException,
} from '@nestjs/common';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import {
  generateSecureToken,
  hashToken,
} from '../../../common/utils/crypto.util';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ProjectService } from './project.service';

export type ShareLinkDto = {
  id: string;
  projectId: string;
  tokenPrefix: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  /** Plaintext token — only on create. */
  token?: string;
  url?: string;
};

export type SharedProjectView = {
  project: {
    name: string;
    description: string | null;
    icon: string | null;
    workspaceName: string;
  };
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    assigneeName: string | null;
  }>;
};

@Injectable()
export class ShareLinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectService,
  ) {}

  async list(
    ctx: WorkspaceContext,
    projectSlug: string,
    actorId: string,
  ): Promise<ShareLinkDto[]> {
    const project = await this.projects.requireAccessibleProject(
      ctx,
      projectSlug,
      actorId,
    );
    const rows = await this.prisma.projectShareLink.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(
    ctx: WorkspaceContext,
    projectSlug: string,
    actorId: string,
    expiresInDays?: number,
  ): Promise<ShareLinkDto> {
    const project = await this.projects.requireAccessibleProject(
      ctx,
      projectSlug,
      actorId,
    );
    const token = `fps_${generateSecureToken(24)}`;
    const tokenHash = hashToken(token);
    const tokenPrefix = token.slice(0, 10);
    const expiresAt =
      expiresInDays && expiresInDays > 0
        ? new Date(Date.now() + expiresInDays * 86_400_000)
        : null;

    const row = await this.prisma.projectShareLink.create({
      data: {
        projectId: project.id,
        tokenHash,
        tokenPrefix,
        createdById: actorId,
        expiresAt,
      },
    });

    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    return {
      ...this.toDto(row),
      token,
      url: `${frontend}/share/${token}`,
    };
  }

  async revoke(
    ctx: WorkspaceContext,
    projectSlug: string,
    linkId: string,
    actorId: string,
  ): Promise<ShareLinkDto> {
    const project = await this.projects.requireAccessibleProject(
      ctx,
      projectSlug,
      actorId,
    );
    const existing = await this.prisma.projectShareLink.findFirst({
      where: { id: linkId, projectId: project.id },
    });
    if (!existing) throw new NotFoundException('Share link not found');

    const row = await this.prisma.projectShareLink.update({
      where: { id: linkId },
      data: { revokedAt: existing.revokedAt ?? new Date() },
    });
    return this.toDto(row);
  }

  async resolve(token: string): Promise<SharedProjectView> {
    const trimmed = token.trim();
    if (!trimmed.startsWith('fps_')) {
      throw new NotFoundException('Share link not found');
    }

    const row = await this.prisma.projectShareLink.findFirst({
      where: { tokenHash: hashToken(trimmed), revokedAt: null },
      include: {
        project: {
          include: {
            workspace: { select: { name: true, deletedAt: true } },
          },
        },
      },
    });

    if (!row || row.project.deletedAt || row.project.workspace.deletedAt) {
      throw new NotFoundException('Share link not found');
    }
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      throw new GoneException('Share link has expired');
    }

    void this.prisma.projectShareLink
      .update({
        where: { id: row.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => undefined);

    const tasks = await this.prisma.task.findMany({
      where: {
        projectId: row.projectId,
        deletedAt: null,
        parentId: null,
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        assignee: { select: { name: true } },
      },
      orderBy: [{ status: 'asc' }, { position: 'asc' }],
      take: 200,
    });

    return {
      project: {
        name: row.project.name,
        description: row.project.description,
        icon: row.project.icon,
        workspaceName: row.project.workspace.name,
      },
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate?.toISOString() ?? null,
        assigneeName: t.assignee?.name ?? null,
      })),
    };
  }

  private toDto(row: {
    id: string;
    projectId: string;
    tokenPrefix: string;
    expiresAt: Date | null;
    revokedAt: Date | null;
    lastUsedAt: Date | null;
    createdAt: Date;
  }): ShareLinkDto {
    return {
      id: row.id,
      projectId: row.projectId,
      tokenPrefix: row.tokenPrefix,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
