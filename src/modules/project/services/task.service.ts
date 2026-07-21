import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import {
  CreateChecklistItemDto,
  CreateLabelDto,
  CreateTaskDto,
  TaskQueryDto,
  UpdateChecklistItemDto,
  UpdateTaskDto,
} from '../dto/task.dto';
import { TaskRepository } from '../repositories/task.repository';
import { ProjectService } from './project.service';
import { toTaskDto, TaskDto, LabelDto } from '../mappers/project.mapper';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class TaskService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly projects: ProjectService,
    private readonly prisma: PrismaService,
  ) {}

  async create(
    ctx: WorkspaceContext,
    projectSlug: string,
    actorId: string,
    dto: CreateTaskDto,
  ): Promise<TaskDto> {
    const project = await this.projects.requireProject(
      ctx.workspaceId,
      projectSlug,
    );
    const status = dto.status ?? TaskStatus.BACKLOG;
    const position = await this.tasks.nextPosition(project.id, status);

    const task = await this.tasks.create({
      title: dto.title.trim(),
      description: dto.description,
      status,
      priority: dto.priority ?? 'MEDIUM',
      storyPoints: dto.storyPoints,
      estimatedMins: dto.estimatedMins,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      position,
      project: { connect: { id: project.id } },
      reporter: { connect: { id: actorId } },
      ...(dto.assigneeId
        ? { assignee: { connect: { id: dto.assigneeId } } }
        : {}),
      ...(dto.parentId ? { parent: { connect: { id: dto.parentId } } } : {}),
      ...(dto.labelIds?.length
        ? {
            labels: {
              create: dto.labelIds.map((labelId) => ({ labelId })),
            },
          }
        : {}),
    });

    await this.prisma.activityLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        projectId: project.id,
        taskId: task.id,
        actorId,
        action: 'TASK_CREATED',
        metadata: { title: task.title },
      },
    });

    return toTaskDto(task);
  }

  async list(
    ctx: WorkspaceContext,
    projectSlug: string,
    query: TaskQueryDto,
  ): Promise<TaskDto[]> {
    const project = await this.projects.requireProject(
      ctx.workspaceId,
      projectSlug,
    );
    const rows = await this.tasks.listByProject(project.id, query);
    return rows.map(toTaskDto);
  }

  async get(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
  ): Promise<TaskDto> {
    const project = await this.projects.requireProject(
      ctx.workspaceId,
      projectSlug,
    );
    const task = await this.tasks.findById(taskId);
    if (!task || task.projectId !== project.id) {
      throw new NotFoundException('Task not found');
    }
    return toTaskDto(task);
  }

  async update(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
    actorId: string,
    dto: UpdateTaskDto,
  ): Promise<TaskDto> {
    const project = await this.projects.requireProject(
      ctx.workspaceId,
      projectSlug,
    );
    const existing = await this.tasks.findById(taskId);
    if (!existing || existing.projectId !== project.id) {
      throw new NotFoundException('Task not found');
    }

    let completedAt: Date | null | undefined;
    if (dto.status === TaskStatus.DONE) {
      completedAt = new Date();
    } else if (dto.status !== undefined) {
      completedAt = null;
    }

    let task = await this.tasks.update(taskId, {
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      ...(dto.storyPoints !== undefined ? { storyPoints: dto.storyPoints } : {}),
      ...(dto.estimatedMins !== undefined
        ? { estimatedMins: dto.estimatedMins }
        : {}),
      ...(dto.actualMins !== undefined ? { actualMins: dto.actualMins } : {}),
      ...(dto.position !== undefined ? { position: dto.position } : {}),
      ...(dto.dueDate !== undefined
        ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
        : {}),
      ...(dto.assigneeId !== undefined
        ? dto.assigneeId
          ? { assignee: { connect: { id: dto.assigneeId } } }
          : { assignee: { disconnect: true } }
        : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
    });

    if (dto.labelIds) {
      const updated = await this.tasks.setLabels(taskId, dto.labelIds);
      if (updated) task = updated;
    }

    await this.prisma.activityLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        projectId: project.id,
        taskId,
        actorId,
        action:
          dto.status && dto.status !== existing.status
            ? 'TASK_STATUS_CHANGED'
            : dto.assigneeId !== undefined
              ? 'TASK_ASSIGNED'
              : 'TASK_UPDATED',
        metadata: { ...dto },
      },
    });

    return toTaskDto(task);
  }

  async remove(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
    actorId: string,
  ): Promise<{ message: string }> {
    const project = await this.projects.requireProject(
      ctx.workspaceId,
      projectSlug,
    );
    const existing = await this.tasks.findById(taskId);
    if (!existing || existing.projectId !== project.id) {
      throw new NotFoundException('Task not found');
    }

    await this.tasks.softDelete(taskId);
    await this.prisma.activityLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        projectId: project.id,
        taskId,
        actorId,
        action: 'TASK_DELETED',
      },
    });

    return { message: 'Task deleted' };
  }

  async addChecklist(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
    dto: CreateChecklistItemDto,
  ) {
    await this.get(ctx, projectSlug, taskId);
    const count = await this.prisma.checklistItem.count({
      where: { taskId, deletedAt: null },
    });
    return this.tasks.createChecklistItem(taskId, dto.title.trim(), count);
  }

  async updateChecklist(
    ctx: WorkspaceContext,
    itemId: string,
    dto: UpdateChecklistItemDto,
  ) {
    const item = await this.tasks.findChecklistItem(itemId);
    if (!item) throw new NotFoundException('Checklist item not found');

    const project = await this.projects.requireProjectById(item.task.projectId);
    if (project.workspaceId !== ctx.workspaceId) {
      throw new ForbiddenException('Checklist item not in this workspace');
    }

    return this.tasks.updateChecklistItem(itemId, {
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.isDone !== undefined ? { isDone: dto.isDone } : {}),
    });
  }

  async removeChecklist(ctx: WorkspaceContext, itemId: string) {
    const item = await this.tasks.findChecklistItem(itemId);
    if (!item) throw new NotFoundException('Checklist item not found');

    const project = await this.projects.requireProjectById(item.task.projectId);
    if (project.workspaceId !== ctx.workspaceId) {
      throw new ForbiddenException('Checklist item not in this workspace');
    }

    await this.tasks.softDeleteChecklistItem(itemId);
    return { message: 'Checklist item deleted' };
  }

  async createLabel(
    ctx: WorkspaceContext,
    dto: CreateLabelDto,
  ): Promise<LabelDto> {
    const label = await this.prisma.label.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: dto.name.trim(),
        color: dto.color ?? '#3B82F6',
      },
    });
    return { id: label.id, name: label.name, color: label.color };
  }

  async listLabels(ctx: WorkspaceContext): Promise<LabelDto[]> {
    const labels = await this.prisma.label.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { name: 'asc' },
    });
    return labels.map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
    }));
  }
}
