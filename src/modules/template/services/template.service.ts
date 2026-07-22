import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProjectPriority,
  ProjectVisibility,
  ProjectTemplate,
  TaskPriority,
  TaskStatus,
} from '@prisma/client';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { slugify, withSlugSuffix } from '../../../common/utils/slug.util';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  ApplyTemplateDto,
  CreateTemplateDto,
  CreateTemplateFromProjectDto,
} from '../dto/template.dto';

export type TemplateTaskPayload = {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  description: string | null;
};

export type TemplatePayload = {
  project: {
    name: string;
    description: string | null;
    icon: string | null;
  };
  tasks: TemplateTaskPayload[];
};

export type TemplateDto = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  icon: string | null;
  payload: TemplatePayload;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
};

const TASK_STATUSES = new Set(Object.values(TaskStatus));
const TASK_PRIORITIES = new Set(Object.values(TaskPriority));

function toTemplateDto(row: ProjectTemplate): TemplateDto {
  const payload = normalizePayload(row.payload);
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    description: row.description,
    icon: row.icon,
    payload,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    taskCount: payload.tasks.length,
  };
}

function normalizePayload(raw: Prisma.JsonValue): TemplatePayload {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const projectRaw =
    obj.project && typeof obj.project === 'object' && !Array.isArray(obj.project)
      ? (obj.project as Record<string, unknown>)
      : {};
  const tasksRaw = Array.isArray(obj.tasks) ? obj.tasks : [];

  return {
    project: {
      name:
        typeof projectRaw.name === 'string' && projectRaw.name.trim()
          ? projectRaw.name.trim()
          : 'Untitled project',
      description:
        typeof projectRaw.description === 'string'
          ? projectRaw.description
          : null,
      icon: typeof projectRaw.icon === 'string' ? projectRaw.icon : null,
    },
    tasks: tasksRaw
      .filter(
        (t): t is Record<string, unknown> =>
          !!t && typeof t === 'object' && !Array.isArray(t),
      )
      .map((t) => ({
        title:
          typeof t.title === 'string' && t.title.trim()
            ? t.title.trim()
            : 'Untitled task',
        status:
          typeof t.status === 'string' && TASK_STATUSES.has(t.status as TaskStatus)
            ? (t.status as TaskStatus)
            : TaskStatus.TODO,
        priority:
          typeof t.priority === 'string' &&
          TASK_PRIORITIES.has(t.priority as TaskPriority)
            ? (t.priority as TaskPriority)
            : TaskPriority.MEDIUM,
        description:
          typeof t.description === 'string' ? t.description : null,
      })),
  };
}

@Injectable()
export class TemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ctx: WorkspaceContext): Promise<TemplateDto[]> {
    const rows = await this.prisma.projectTemplate.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toTemplateDto);
  }

  async get(ctx: WorkspaceContext, templateId: string): Promise<TemplateDto> {
    const row = await this.requireTemplate(ctx, templateId);
    return toTemplateDto(row);
  }

  async create(
    ctx: WorkspaceContext,
    actorId: string,
    dto: CreateTemplateDto,
  ): Promise<TemplateDto> {
    const payload = normalizePayload(dto.payload as Prisma.JsonValue);
    const row = await this.prisma.projectTemplate.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        icon: dto.icon?.trim() || null,
        payload: payload as unknown as Prisma.InputJsonValue,
        createdById: actorId,
      },
    });
    return toTemplateDto(row);
  }

  async createFromProject(
    ctx: WorkspaceContext,
    actorId: string,
    dto: CreateTemplateFromProjectDto,
  ): Promise<TemplateDto> {
    const project = await this.prisma.project.findFirst({
      where: {
        workspaceId: ctx.workspaceId,
        slug: dto.projectSlug,
        deletedAt: null,
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const tasks = await this.prisma.task.findMany({
      where: { projectId: project.id, deletedAt: null },
      orderBy: [{ status: 'asc' }, { position: 'asc' }],
      select: {
        title: true,
        status: true,
        priority: true,
        description: true,
      },
    });

    const payload: TemplatePayload = {
      project: {
        name: project.name,
        description: project.description,
        icon: project.icon,
      },
      tasks: tasks.map((t) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        description: t.description,
      })),
    };

    const row = await this.prisma.projectTemplate.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: dto.name.trim(),
        description: dto.description?.trim() || project.description,
        icon: dto.icon?.trim() || project.icon,
        payload: payload as unknown as Prisma.InputJsonValue,
        createdById: actorId,
      },
    });
    return toTemplateDto(row);
  }

  async apply(
    ctx: WorkspaceContext,
    actorId: string,
    templateId: string,
    dto: ApplyTemplateDto = {},
  ) {
    const template = await this.requireTemplate(ctx, templateId);
    const payload = normalizePayload(template.payload);
    const projectName = dto.name?.trim() || payload.project.name;

    const baseSlug = slugify(projectName);
    if (!baseSlug) {
      throw new BadRequestException('Unable to generate a valid slug');
    }

    let slug = baseSlug;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      slug = withSlugSuffix(baseSlug, attempt);
      const exists = await this.prisma.project.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          slug,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!exists) break;
      if (attempt === 19) {
        throw new ConflictException('Unable to allocate a unique project slug');
      }
    }

    const project = await this.prisma.project.create({
      data: {
        name: projectName,
        slug,
        description: payload.project.description,
        icon: payload.project.icon,
        visibility: ProjectVisibility.WORKSPACE,
        priority: ProjectPriority.MEDIUM,
        workspace: { connect: { id: ctx.workspaceId } },
        members: { create: { userId: actorId } },
      },
    });

    await this.prisma.activityLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        projectId: project.id,
        actorId,
        action: 'PROJECT_CREATED',
        metadata: {
          name: project.name,
          slug: project.slug,
          fromTemplateId: template.id,
        },
      },
    });

    for (let i = 0; i < payload.tasks.length; i += 1) {
      const def = payload.tasks[i]!;
      const task = await this.prisma.task.create({
        data: {
          projectId: project.id,
          reporterId: actorId,
          title: def.title,
          description: def.description,
          status: def.status,
          priority: def.priority,
          position: (i + 1) * 1000,
        },
      });
      await this.prisma.activityLog.create({
        data: {
          workspaceId: ctx.workspaceId,
          projectId: project.id,
          taskId: task.id,
          actorId,
          action: 'TASK_CREATED',
          metadata: { title: task.title, fromTemplateId: template.id },
        },
      });
    }

    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      icon: project.icon,
      templateId: template.id,
      taskCount: payload.tasks.length,
    };
  }

  async remove(
    ctx: WorkspaceContext,
    templateId: string,
  ): Promise<{ message: string }> {
    await this.requireTemplate(ctx, templateId);
    await this.prisma.projectTemplate.delete({ where: { id: templateId } });
    return { message: 'Template deleted' };
  }

  private async requireTemplate(
    ctx: WorkspaceContext,
    templateId: string,
  ): Promise<ProjectTemplate> {
    const row = await this.prisma.projectTemplate.findFirst({
      where: { id: templateId, workspaceId: ctx.workspaceId },
    });
    if (!row) {
      throw new NotFoundException('Template not found');
    }
    return row;
  }
}
