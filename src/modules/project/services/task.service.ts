import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  Prisma,
  TaskDependencyType,
  TaskStatus,
} from '@prisma/client';
import {
  CreateChecklistItemDto,
  CreateLabelDto,
  CreateTaskDto,
  CalendarQueryDto,
  CreateTaskDependencyDto,
  MoveTaskDto,
  RoadmapQueryDto,
  TaskQueryDto,
  UpdateChecklistItemDto,
  UpdateLabelDto,
  UpdateTaskDto,
} from '../dto/task.dto';
import { TaskRepository } from '../repositories/task.repository';
import { ProjectService } from './project.service';
import {
  toTaskDto,
  TaskDto,
  LabelDto,
  TaskDependenciesDto,
  TaskDependencyDto,
  TaskSummaryDto,
  RoadmapTaskDto,
} from '../mappers/project.mapper';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { NotificationService } from '../../collab/services/notification.service';

const taskSummarySelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  dueDate: true,
} as const;

function toTaskSummary(task: {
  id: string;
  title: string;
  status: TaskStatus;
  priority: import('@prisma/client').TaskPriority;
  dueDate: Date | null;
}): TaskSummaryDto {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString() ?? null,
  };
}

@Injectable()
export class TaskService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly projects: ProjectService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationService,
  ) {}

  async create(
    ctx: WorkspaceContext,
    projectSlug: string,
    actorId: string,
    dto: CreateTaskDto,
  ): Promise<TaskDto> {
    const project = await this.projects.requireAccessibleProject(
      ctx,
      projectSlug,
      actorId,
    );

    if (dto.parentId) {
      const parent = await this.tasks.findById(dto.parentId);
      if (!parent || parent.projectId !== project.id) {
        throw new NotFoundException('Parent task not found');
      }
      if (parent.parentId) {
        throw new ForbiddenException('Cannot nest subtasks more than one level');
      }
    }

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

    this.realtime.emitTaskChanged({
      workspaceSlug: ctx.slug,
      projectSlug,
      taskId: task.id,
      action: 'created',
    });

    if (dto.assigneeId && dto.assigneeId !== actorId) {
      await this.notifications.notify({
        userId: dto.assigneeId,
        workspaceId: ctx.workspaceId,
        workspaceSlug: ctx.slug,
        type: NotificationType.TASK_ASSIGNED,
        title: 'Task assigned to you',
        body: `You were assigned "${task.title}"`,
        data: {
          taskId: task.id,
          projectId: project.id,
          projectSlug,
        },
        prefKey: 'taskAssigned',
      });
    }

    return toTaskDto(task);
  }

  async listSubtasks(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
    userId: string,
  ): Promise<TaskDto[]> {
    await this.get(ctx, projectSlug, taskId, userId);
    const project = await this.projects.requireAccessibleProject(
      ctx,
      projectSlug,
      userId,
    );
    const rows = await this.tasks.listSubtasks(project.id, taskId);
    return rows.map(toTaskDto);
  }

  async list(
    ctx: WorkspaceContext,
    projectSlug: string,
    query: TaskQueryDto,
    userId: string,
  ): Promise<TaskDto[]> {
    const project = await this.projects.requireAccessibleProject(
      ctx,
      projectSlug,
      userId,
    );
    const rows = await this.tasks.listByProject(project.id, query);
    return rows.map(toTaskDto);
  }

  async get(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
    userId: string,
  ): Promise<TaskDto> {
    const project = await this.projects.requireAccessibleProject(
      ctx,
      projectSlug,
      userId,
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
    const project = await this.projects.requireAccessibleProject(
      ctx,
      projectSlug,
      actorId,
    );
    const existing = await this.tasks.findById(taskId);
    if (!existing || existing.projectId !== project.id) {
      throw new NotFoundException('Task not found');
    }

    if (dto.cycleId) {
      const cycle = await this.prisma.cycle.findFirst({
        where: { id: dto.cycleId, workspaceId: ctx.workspaceId },
      });
      if (!cycle) {
        throw new NotFoundException('Cycle not found');
      }
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
      ...(dto.cycleId !== undefined
        ? dto.cycleId
          ? { cycle: { connect: { id: dto.cycleId } } }
          : { cycle: { disconnect: true } }
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

    this.realtime.emitTaskChanged({
      workspaceSlug: ctx.slug,
      projectSlug,
      taskId,
      action:
        dto.status !== undefined && dto.position !== undefined
          ? 'moved'
          : 'updated',
    });

    if (
      dto.assigneeId &&
      dto.assigneeId !== existing.assigneeId &&
      dto.assigneeId !== actorId
    ) {
      await this.notifications.notify({
        userId: dto.assigneeId,
        workspaceId: ctx.workspaceId,
        workspaceSlug: ctx.slug,
        type: NotificationType.TASK_ASSIGNED,
        title: 'Task assigned to you',
        body: `You were assigned "${task.title}"`,
        data: {
          taskId,
          projectId: project.id,
          projectSlug,
        },
        prefKey: 'taskAssigned',
      });
    }

    if (
      dto.status === TaskStatus.DONE &&
      existing.status !== TaskStatus.DONE &&
      task.assigneeId &&
      task.assigneeId !== actorId
    ) {
      await this.notifications.notify({
        userId: task.assigneeId,
        workspaceId: ctx.workspaceId,
        workspaceSlug: ctx.slug,
        type: NotificationType.COMPLETED,
        title: 'Task completed',
        body: `"${task.title}" was marked as done`,
        data: {
          taskId,
          projectId: project.id,
          projectSlug,
        },
        prefKey: 'completed',
      });
    } else if (
      dto.status !== undefined &&
      dto.status !== existing.status &&
      task.assigneeId &&
      task.assigneeId !== actorId &&
      dto.status !== TaskStatus.DONE
    ) {
      await this.notifications.notify({
        userId: task.assigneeId,
        workspaceId: ctx.workspaceId,
        workspaceSlug: ctx.slug,
        type: NotificationType.TASK_UPDATED,
        title: 'Task status updated',
        body: `"${task.title}" moved to ${dto.status.replace('_', ' ')}`,
        data: {
          taskId,
          projectId: project.id,
          projectSlug,
          status: dto.status,
        },
        prefKey: 'taskUpdated',
      });
    }

    return toTaskDto(task);
  }

  async remove(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
    actorId: string,
  ): Promise<{ message: string }> {
    const project = await this.projects.requireAccessibleProject(
      ctx,
      projectSlug,
      actorId,
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

    this.realtime.emitTaskChanged({
      workspaceSlug: ctx.slug,
      projectSlug,
      taskId,
      action: 'deleted',
    });

    return { message: 'Task deleted' };
  }

  async move(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
    actorId: string,
    dto: MoveTaskDto,
  ): Promise<TaskDto> {
    return this.update(ctx, projectSlug, taskId, actorId, {
      status: dto.status,
      position: dto.position,
    });
  }

  async calendar(
    ctx: WorkspaceContext,
    query: CalendarQueryDto,
    userId: string,
  ): Promise<
    Array<
      TaskDto & {
        project: { id: string; name: string; slug: string; icon: string | null };
      }
    >
  > {
    const from = new Date(query.from);
    const to = new Date(query.to);
    to.setHours(23, 59, 59, 999);

    const rows = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        parentId: null,
        dueDate: { gte: from, lte: to },
        project: {
          workspaceId: ctx.workspaceId,
          deletedAt: null,
          ...this.projects.visibilityWhere(userId, ctx.role),
        },
      },
      include: {
        reporter: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        labels: { include: { label: true } },
        checklist: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
        },
        _count: { select: { subtasks: { where: { deletedAt: null } } } },
        project: {
          select: { id: true, name: true, slug: true, icon: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    return rows.map((row) => ({
      ...toTaskDto(row),
      project: row.project,
    }));
  }

  async roadmap(
    ctx: WorkspaceContext,
    query: RoadmapQueryDto,
    userId: string,
  ): Promise<RoadmapTaskDto[]> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    to.setHours(23, 59, 59, 999);

    const rows = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        parentId: null,
        dueDate: { gte: from, lte: to },
        project: {
          workspaceId: ctx.workspaceId,
          deletedAt: null,
          ...this.projects.visibilityWhere(userId, ctx.role),
        },
      },
      include: {
        reporter: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        labels: { include: { label: true } },
        checklist: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
        },
        _count: { select: { subtasks: { where: { deletedAt: null } } } },
        project: {
          select: { id: true, name: true, slug: true, icon: true },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });

    return rows.map((row) => ({
      ...toTaskDto(row),
      // Timeline bar start: createdAt when no dedicated start date exists
      startDate: row.createdAt.toISOString(),
      project: row.project,
    }));
  }

  async listDependencies(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
    userId: string,
  ): Promise<TaskDependenciesDto> {
    const project = await this.projects.requireAccessibleProject(
      ctx,
      projectSlug,
      userId,
    );
    const task = await this.tasks.findById(taskId);
    if (!task || task.projectId !== project.id) {
      throw new NotFoundException('Task not found');
    }

    const rows = await this.prisma.taskDependency.findMany({
      where: {
        OR: [{ fromTaskId: taskId }, { toTaskId: taskId }],
      },
      include: {
        fromTask: { select: taskSummarySelect },
        toTask: { select: taskSummarySelect },
      },
      orderBy: { createdAt: 'asc' },
    });

    const blocking: TaskDependencyDto[] = [];
    const blockedBy: TaskDependencyDto[] = [];
    const relatesTo: TaskDependencyDto[] = [];

    for (const row of rows) {
      const related =
        row.fromTaskId === taskId ? row.toTask : row.fromTask;
      const dto: TaskDependencyDto = {
        id: row.id,
        fromTaskId: row.fromTaskId,
        toTaskId: row.toTaskId,
        type: row.type,
        createdAt: row.createdAt.toISOString(),
        relatedTask: toTaskSummary(related),
      };

      if (row.type === TaskDependencyType.RELATES_TO) {
        relatesTo.push(dto);
      } else if (row.fromTaskId === taskId) {
        // Canonical direction: from blocks to
        blocking.push(dto);
      } else {
        blockedBy.push(dto);
      }
    }

    return { blocking, blockedBy, relatesTo };
  }

  async addDependency(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
    actorId: string,
    dto: CreateTaskDependencyDto,
  ): Promise<TaskDependencyDto> {
    const project = await this.projects.requireAccessibleProject(
      ctx,
      projectSlug,
      actorId,
    );
    const task = await this.tasks.findById(taskId);
    if (!task || task.projectId !== project.id) {
      throw new NotFoundException('Task not found');
    }

    if (dto.toTaskId === taskId) {
      throw new BadRequestException('A task cannot depend on itself');
    }

    const other = await this.tasks.findById(dto.toTaskId);
    if (!other || other.projectId !== project.id) {
      throw new NotFoundException('Related task not found');
    }

    // BLOCKS: taskId → toTaskId
    // IS_BLOCKED_BY: reverse endpoints (toTaskId → taskId)
    // RELATES_TO: taskId → toTaskId
    let fromTaskId = taskId;
    let toTaskId = dto.toTaskId;
    if (dto.type === TaskDependencyType.IS_BLOCKED_BY) {
      fromTaskId = dto.toTaskId;
      toTaskId = taskId;
    }

    try {
      const created = await this.prisma.taskDependency.create({
        data: {
          fromTaskId,
          toTaskId,
          type: dto.type,
        },
        include: {
          fromTask: { select: taskSummarySelect },
          toTask: { select: taskSummarySelect },
        },
      });

      const related =
        created.fromTaskId === taskId ? created.toTask : created.fromTask;

      return {
        id: created.id,
        fromTaskId: created.fromTaskId,
        toTaskId: created.toTaskId,
        type: created.type,
        createdAt: created.createdAt.toISOString(),
        relatedTask: toTaskSummary(related),
      };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Dependency already exists');
      }
      throw err;
    }
  }

  async removeDependency(
    ctx: WorkspaceContext,
    dependencyId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const dep = await this.prisma.taskDependency.findUnique({
      where: { id: dependencyId },
      include: {
        fromTask: {
          select: {
            id: true,
            projectId: true,
            deletedAt: true,
            project: { select: { workspaceId: true, slug: true } },
          },
        },
      },
    });

    if (!dep || dep.fromTask.deletedAt) {
      throw new NotFoundException('Dependency not found');
    }
    if (dep.fromTask.project.workspaceId !== ctx.workspaceId) {
      throw new NotFoundException('Dependency not found');
    }

    await this.projects.requireAccessibleProject(
      ctx,
      dep.fromTask.project.slug,
      userId,
    );

    await this.prisma.taskDependency.delete({ where: { id: dependencyId } });
    return { message: 'Dependency deleted' };
  }

  async addChecklist(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
    actorId: string,
    dto: CreateChecklistItemDto,
  ) {
    await this.get(ctx, projectSlug, taskId, actorId);
    const count = await this.prisma.checklistItem.count({
      where: { taskId, deletedAt: null },
    });
    return this.tasks.createChecklistItem(taskId, dto.title.trim(), count);
  }

  async updateChecklist(
    ctx: WorkspaceContext,
    itemId: string,
    userId: string,
    dto: UpdateChecklistItemDto,
  ) {
    const item = await this.tasks.findChecklistItem(itemId);
    if (!item) throw new NotFoundException('Checklist item not found');

    const project = await this.projects.requireProjectById(item.task.projectId);
    if (project.workspaceId !== ctx.workspaceId) {
      throw new ForbiddenException('Checklist item not in this workspace');
    }
    await this.projects.assertCanAccess(project, userId, ctx.role);

    return this.tasks.updateChecklistItem(itemId, {
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.isDone !== undefined ? { isDone: dto.isDone } : {}),
    });
  }

  async removeChecklist(ctx: WorkspaceContext, itemId: string, userId: string) {
    const item = await this.tasks.findChecklistItem(itemId);
    if (!item) throw new NotFoundException('Checklist item not found');

    const project = await this.projects.requireProjectById(item.task.projectId);
    if (project.workspaceId !== ctx.workspaceId) {
      throw new ForbiddenException('Checklist item not in this workspace');
    }
    await this.projects.assertCanAccess(project, userId, ctx.role);

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

  async updateLabel(
    ctx: WorkspaceContext,
    labelId: string,
    dto: UpdateLabelDto,
  ): Promise<LabelDto> {
    const label = await this.prisma.label.findFirst({
      where: { id: labelId, workspaceId: ctx.workspaceId },
    });
    if (!label) throw new NotFoundException('Label not found');

    const updated = await this.prisma.label.update({
      where: { id: labelId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
      },
    });
    return { id: updated.id, name: updated.name, color: updated.color };
  }

  async deleteLabel(
    ctx: WorkspaceContext,
    labelId: string,
  ): Promise<{ message: string }> {
    const label = await this.prisma.label.findFirst({
      where: { id: labelId, workspaceId: ctx.workspaceId },
    });
    if (!label) throw new NotFoundException('Label not found');

    await this.prisma.label.delete({ where: { id: labelId } });
    return { message: 'Label deleted' };
  }
}
