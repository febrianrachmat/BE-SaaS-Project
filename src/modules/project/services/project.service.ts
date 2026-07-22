import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Project,
  ProjectPriority,
  ProjectVisibility,
  TaskPriority,
  TaskStatus,
  WorkspaceRole,
} from '@prisma/client';
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

  async createSample(
    ctx: WorkspaceContext,
    actorId: string,
  ): Promise<ProjectDto> {
    const existing = await this.prisma.project.count({
      where: { workspaceId: ctx.workspaceId, deletedAt: null },
    });
    if (existing > 0) {
      throw new BadRequestException(
        'Sample project is only available for empty workspaces',
      );
    }

    const project = await this.create(ctx, actorId, {
      name: 'Getting Started',
      slug: 'getting-started',
      description:
        'A sample project to explore boards, tasks, labels, and collaboration.',
      icon: '🚀',
      priority: ProjectPriority.MEDIUM,
      visibility: ProjectVisibility.WORKSPACE,
    });

    const labelDefs = [
      { name: 'Bug', color: '#EF4444' },
      { name: 'Feature', color: '#3B82F6' },
      { name: 'Docs', color: '#10B981' },
    ];
    const labels = [];
    for (const def of labelDefs) {
      labels.push(
        await this.prisma.label.create({
          data: {
            workspaceId: ctx.workspaceId,
            name: def.name,
            color: def.color,
          },
        }),
      );
    }

    const taskDefs = [
      {
        title: 'Invite a teammate',
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        labelIdx: 1,
      },
      {
        title: 'Explore the Kanban board',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
        labelIdx: 1,
      },
      {
        title: 'Add a comment with @mention',
        status: TaskStatus.BACKLOG,
        priority: TaskPriority.LOW,
        labelIdx: 2,
      },
      {
        title: 'Try filtering My Work',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        labelIdx: 0,
      },
    ];

    for (let i = 0; i < taskDefs.length; i += 1) {
      const def = taskDefs[i]!;
      const task = await this.prisma.task.create({
        data: {
          projectId: project.id,
          reporterId: actorId,
          assigneeId: actorId,
          title: def.title,
          status: def.status,
          priority: def.priority,
          position: (i + 1) * 1000,
          labels: {
            create: [{ labelId: labels[def.labelIdx]!.id }],
          },
        },
      });
      await this.prisma.activityLog.create({
        data: {
          workspaceId: ctx.workspaceId,
          projectId: project.id,
          taskId: task.id,
          actorId,
          action: 'TASK_CREATED',
          metadata: { title: task.title, sample: true },
        },
      });
    }

    return this.get(ctx, project.slug, actorId);
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
    const project = await this.requireAccessibleProject(
      ctx,
      projectSlug,
      userId,
    );
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
    const existing = await this.requireAccessibleProject(
      ctx,
      projectSlug,
      actorId,
    );
    const project = await this.projects.update(existing.id, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
      ...(dto.coverUrl !== undefined ? { coverUrl: dto.coverUrl } : {}),
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
    const existing = await this.requireAccessibleProject(
      ctx,
      projectSlug,
      actorId,
    );
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
    actorId: string,
  ): Promise<{ message: string }> {
    await this.requireAccessibleProject(ctx, projectSlug, actorId);
    const existing = await this.requireProject(ctx.workspaceId, projectSlug);
    await this.projects.softDelete(existing.id);
    return { message: 'Project deleted' };
  }

  async toggleFavorite(
    ctx: WorkspaceContext,
    projectSlug: string,
    userId: string,
  ): Promise<{ isFavorite: boolean }> {
    const project = await this.requireAccessibleProject(
      ctx,
      projectSlug,
      userId,
    );
    const existing = await this.projects.isFavorite(project.id, userId);
    if (existing) {
      await this.projects.removeFavorite(project.id, userId);
      return { isFavorite: false };
    }
    await this.projects.addFavorite(project.id, userId);
    return { isFavorite: true };
  }

  async listMembers(
    ctx: WorkspaceContext,
    projectSlug: string,
    userId: string,
  ) {
    const project = await this.requireAccessibleProject(
      ctx,
      projectSlug,
      userId,
    );
    const rows = await this.prisma.projectMember.findMany({
      where: { projectId: project.id, deletedAt: null },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map((m) => ({
      id: m.id,
      userId: m.userId,
      joinedAt: m.joinedAt.toISOString(),
      user: m.user,
    }));
  }

  async addMember(
    ctx: WorkspaceContext,
    projectSlug: string,
    actorId: string,
    targetUserId: string,
  ) {
    const project = await this.requireAccessibleProject(
      ctx,
      projectSlug,
      actorId,
    );

    const workspaceMember = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId: ctx.workspaceId,
        userId: targetUserId,
        deletedAt: null,
      },
    });
    if (!workspaceMember) {
      throw new BadRequestException('User is not a workspace member');
    }

    const existing = await this.prisma.projectMember.findFirst({
      where: { projectId: project.id, userId: targetUserId },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException('User is already a project member');
    }

    const member = existing
      ? await this.prisma.projectMember.update({
          where: { id: existing.id },
          data: { deletedAt: null, joinedAt: new Date() },
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        })
      : await this.prisma.projectMember.create({
          data: { projectId: project.id, userId: targetUserId },
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        });

    return {
      id: member.id,
      userId: member.userId,
      joinedAt: member.joinedAt.toISOString(),
      user: member.user,
    };
  }

  async removeMember(
    ctx: WorkspaceContext,
    projectSlug: string,
    actorId: string,
    memberId: string,
  ) {
    const project = await this.requireAccessibleProject(
      ctx,
      projectSlug,
      actorId,
    );
    const member = await this.prisma.projectMember.findFirst({
      where: { id: memberId, projectId: project.id, deletedAt: null },
    });
    if (!member) throw new NotFoundException('Project member not found');

    const count = await this.prisma.projectMember.count({
      where: { projectId: project.id, deletedAt: null },
    });
    if (count <= 1) {
      throw new BadRequestException('Cannot remove the last project member');
    }

    await this.prisma.projectMember.update({
      where: { id: member.id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Project member removed' };
  }

  async requireProject(workspaceId: string, projectSlug: string) {
    const project = await this.projects.findBySlug(workspaceId, projectSlug);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async requireAccessibleProject(
    ctx: WorkspaceContext,
    projectSlug: string,
    userId: string,
  ) {
    const project = await this.requireProject(ctx.workspaceId, projectSlug);
    await this.assertCanAccess(project, userId, ctx.role);
    return project;
  }

  async requireProjectById(projectId: string) {
    const project = await this.projects.findById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async assertCanAccess(
    project: Project,
    userId: string,
    role: WorkspaceRole,
  ) {
    if (project.visibility === ProjectVisibility.WORKSPACE) return;
    if (role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN) return;

    const member = await this.prisma.projectMember.findFirst({
      where: {
        projectId: project.id,
        userId,
        deletedAt: null,
      },
    });
    if (!member) {
      throw new NotFoundException('Project not found');
    }
  }

  visibilityWhere(userId: string, role: WorkspaceRole) {
    if (role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN) {
      return {};
    }
    return {
      OR: [
        { visibility: ProjectVisibility.WORKSPACE },
        { members: { some: { userId, deletedAt: null } } },
      ],
    };
  }
}
