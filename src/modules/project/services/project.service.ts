import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectPriority, ProjectVisibility } from '@prisma/client';
import { CreateProjectDto, UpdateProjectDto } from '../dto/project.dto';
import { ProjectRepository } from '../repositories/project.repository';
import { toProjectDto, ProjectDto } from '../mappers/project.mapper';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { slugify, withSlugSuffix } from '../../../common/utils/slug.util';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class ProjectService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(
    ctx: WorkspaceContext,
    actorId: string,
    dto: CreateProjectDto,
  ): Promise<ProjectDto> {
    const baseSlug = slugify(dto.slug?.trim() || dto.name);
    if (!baseSlug) {
      throw new BadRequestException('Unable to generate a valid slug');
    }

    let slug = baseSlug;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      slug = withSlugSuffix(baseSlug, attempt);
      if (!(await this.projects.slugExists(ctx.workspaceId, slug))) break;
      if (attempt === 19) {
        throw new ConflictException('Unable to allocate a unique project slug');
      }
    }

    const project = await this.projects.create({
      name: dto.name.trim(),
      slug,
      description: dto.description?.trim(),
      icon: dto.icon,
      visibility: dto.visibility ?? ProjectVisibility.WORKSPACE,
      priority: dto.priority ?? ProjectPriority.MEDIUM,
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      workspace: { connect: { id: ctx.workspaceId } },
      members: {
        create: { userId: actorId },
      },
    });

    await this.prisma.activityLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        projectId: project.id,
        actorId,
        action: 'PROJECT_CREATED',
        metadata: { name: project.name, slug: project.slug },
      },
    });

    return toProjectDto(project, { isFavorite: false, taskCount: 0 });
  }

  async list(ctx: WorkspaceContext, userId: string): Promise<ProjectDto[]> {
    const rows = await this.projects.listByWorkspace(ctx.workspaceId, userId);
    return rows.map((p) =>
      toProjectDto(p, {
        isFavorite: p.favorites.length > 0,
        taskCount: p._count.tasks,
      }),
    );
  }

  async get(
    ctx: WorkspaceContext,
    projectSlug: string,
    userId: string,
  ): Promise<ProjectDto> {
    const project = await this.requireProject(ctx.workspaceId, projectSlug);
    const favorite = await this.projects.isFavorite(project.id, userId);
    const taskCount = await this.prisma.task.count({
      where: { projectId: project.id, deletedAt: null },
    });
    return toProjectDto(project, {
      isFavorite: !!favorite,
      taskCount,
    });
  }

  async update(
    ctx: WorkspaceContext,
    projectSlug: string,
    actorId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectDto> {
    const existing = await this.requireProject(ctx.workspaceId, projectSlug);
    const project = await this.projects.update(existing.id, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
      ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      ...(dto.deadline !== undefined
        ? { deadline: dto.deadline ? new Date(dto.deadline) : null }
        : {}),
    });

    await this.prisma.activityLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        projectId: project.id,
        actorId,
        action: 'PROJECT_UPDATED',
        metadata: { ...dto },
      },
    });

    return toProjectDto(project);
  }

  async archive(
    ctx: WorkspaceContext,
    projectSlug: string,
    actorId: string,
    archive: boolean,
  ): Promise<ProjectDto> {
    const existing = await this.requireProject(ctx.workspaceId, projectSlug);
    const project = await this.projects.update(existing.id, {
      archivedAt: archive ? new Date() : null,
      status: archive ? 'ARCHIVED' : 'ACTIVE',
    });

    await this.prisma.activityLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        projectId: project.id,
        actorId,
        action: 'PROJECT_ARCHIVED',
        metadata: { archived: archive },
      },
    });

    return toProjectDto(project);
  }

  async remove(
    ctx: WorkspaceContext,
    projectSlug: string,
  ): Promise<{ message: string }> {
    const existing = await this.requireProject(ctx.workspaceId, projectSlug);
    await this.projects.softDelete(existing.id);
    return { message: 'Project deleted' };
  }

  async toggleFavorite(
    ctx: WorkspaceContext,
    projectSlug: string,
    userId: string,
  ): Promise<{ isFavorite: boolean }> {
    const project = await this.requireProject(ctx.workspaceId, projectSlug);
    const existing = await this.projects.isFavorite(project.id, userId);
    if (existing) {
      await this.projects.removeFavorite(project.id, userId);
      return { isFavorite: false };
    }
    await this.projects.addFavorite(project.id, userId);
    return { isFavorite: true };
  }

  async requireProject(workspaceId: string, projectSlug: string) {
    const project = await this.projects.findBySlug(workspaceId, projectSlug);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async requireProjectById(projectId: string) {
    const project = await this.projects.findById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }
}
