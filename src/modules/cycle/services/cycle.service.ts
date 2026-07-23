import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cycle, CycleStatus, TaskStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { CreateCycleDto, UpdateCycleDto } from '../dto/cycle.dto';

export type CycleDto = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: CycleStatus;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
  doneCount?: number;
  progress?: number;
};

export type CycleBoardTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  dueDate: string | null;
  project: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
  };
  assignee: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
};

export type CycleBoardDto = CycleDto & {
  tasksByStatus: Array<{ status: TaskStatus; count: number }>;
  tasks: CycleBoardTask[];
};

export type CycleCandidateTask = CycleBoardTask;

function toCycleDto(
  cycle: Cycle & {
    _count?: { tasks: number };
    doneCount?: number;
  },
): CycleDto {
  const taskCount = cycle._count?.tasks;
  const doneCount = cycle.doneCount;
  const progress =
    typeof taskCount === 'number' &&
    taskCount > 0 &&
    typeof doneCount === 'number'
      ? Math.round((doneCount / taskCount) * 100)
      : typeof taskCount === 'number'
        ? 0
        : undefined;

  return {
    id: cycle.id,
    workspaceId: cycle.workspaceId,
    name: cycle.name,
    description: cycle.description,
    status: cycle.status,
    startDate: cycle.startDate?.toISOString() ?? null,
    endDate: cycle.endDate?.toISOString() ?? null,
    createdAt: cycle.createdAt.toISOString(),
    updatedAt: cycle.updatedAt.toISOString(),
    taskCount,
    doneCount,
    progress,
  };
}

@Injectable()
export class CycleService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ctx: WorkspaceContext): Promise<CycleDto[]> {
    const rows = await this.prisma.cycle.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: {
        _count: {
          select: { tasks: { where: { deletedAt: null, parentId: null } } },
        },
        tasks: {
          where: {
            deletedAt: null,
            parentId: null,
            status: TaskStatus.DONE,
          },
          select: { id: true },
        },
      },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) =>
      toCycleDto({ ...row, doneCount: row.tasks.length }),
    );
  }

  async getBoard(
    ctx: WorkspaceContext,
    cycleId: string,
  ): Promise<CycleBoardDto> {
    const cycle = await this.requireCycle(ctx, cycleId);

    const tasks = await this.prisma.task.findMany({
      where: {
        cycleId,
        deletedAt: null,
        parentId: null,
        project: {
          workspaceId: ctx.workspaceId,
          deletedAt: null,
        },
      },
      include: {
        project: {
          select: { id: true, name: true, slug: true, icon: true },
        },
        assignee: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: [{ status: 'asc' }, { position: 'asc' }, { updatedAt: 'desc' }],
      take: 500,
    });

    const statusCounts = new Map<TaskStatus, number>();
    for (const status of Object.values(TaskStatus)) {
      statusCounts.set(status, 0);
    }
    for (const task of tasks) {
      statusCounts.set(task.status, (statusCounts.get(task.status) ?? 0) + 1);
    }

    const doneCount = statusCounts.get(TaskStatus.DONE) ?? 0;
    const taskCount = tasks.length;

    return {
      ...toCycleDto({
        ...cycle,
        _count: { tasks: taskCount },
        doneCount,
      }),
      tasksByStatus: [...statusCounts.entries()].map(([status, count]) => ({
        status,
        count,
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate?.toISOString() ?? null,
        project: t.project,
        assignee: t.assignee,
      })),
    };
  }

  async listCandidates(
    ctx: WorkspaceContext,
    cycleId: string,
    q?: string,
  ): Promise<CycleCandidateTask[]> {
    await this.requireCycle(ctx, cycleId);
    const query = q?.trim();

    const rows = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        parentId: null,
        OR: [{ cycleId: null }, { cycleId: { not: cycleId } }],
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELED] },
        project: {
          workspaceId: ctx.workspaceId,
          deletedAt: null,
          archivedAt: null,
        },
        ...(query
          ? {
              AND: [
                {
                  OR: [
                    {
                      title: {
                        contains: query,
                        mode: 'insensitive' as const,
                      },
                    },
                    {
                      project: {
                        name: {
                          contains: query,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                  ],
                },
              ],
            }
          : {}),
      },
      include: {
        project: {
          select: { id: true, name: true, slug: true, icon: true },
        },
        assignee: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 40,
    });

    return rows.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate?.toISOString() ?? null,
      project: t.project,
      assignee: t.assignee,
    }));
  }

  async addTask(
    ctx: WorkspaceContext,
    cycleId: string,
    taskId: string,
  ): Promise<CycleBoardDto> {
    await this.requireCycle(ctx, cycleId);
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        deletedAt: null,
        project: { workspaceId: ctx.workspaceId, deletedAt: null },
      },
    });
    if (!task) throw new NotFoundException('Task not found');

    await this.prisma.task.update({
      where: { id: taskId },
      data: { cycleId },
    });

    return this.getBoard(ctx, cycleId);
  }

  async removeTask(
    ctx: WorkspaceContext,
    cycleId: string,
    taskId: string,
  ): Promise<CycleBoardDto> {
    await this.requireCycle(ctx, cycleId);
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        cycleId,
        deletedAt: null,
        project: { workspaceId: ctx.workspaceId, deletedAt: null },
      },
    });
    if (!task) throw new NotFoundException('Task not found in this cycle');

    await this.prisma.task.update({
      where: { id: taskId },
      data: { cycleId: null },
    });

    return this.getBoard(ctx, cycleId);
  }

  async create(
    ctx: WorkspaceContext,
    dto: CreateCycleDto,
  ): Promise<CycleDto> {
    this.assertDateOrder(dto.startDate, dto.endDate);

    if (dto.status === CycleStatus.ACTIVE) {
      await this.completeOtherActive(ctx.workspaceId);
    }

    const cycle = await this.prisma.cycle.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        status: dto.status ?? CycleStatus.PLANNED,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
      include: {
        _count: {
          select: { tasks: { where: { deletedAt: null, parentId: null } } },
        },
      },
    });
    return toCycleDto({ ...cycle, doneCount: 0 });
  }

  async update(
    ctx: WorkspaceContext,
    cycleId: string,
    dto: UpdateCycleDto,
  ): Promise<CycleDto> {
    const existing = await this.requireCycle(ctx, cycleId);
    this.assertDateOrder(
      dto.startDate !== undefined
        ? dto.startDate
        : (existing.startDate?.toISOString() ?? null),
      dto.endDate !== undefined
        ? dto.endDate
        : (existing.endDate?.toISOString() ?? null),
    );

    if (
      dto.status === CycleStatus.ACTIVE &&
      existing.status !== CycleStatus.ACTIVE
    ) {
      await this.completeOtherActive(ctx.workspaceId, cycleId);
    }

    const cycle = await this.prisma.cycle.update({
      where: { id: cycleId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: dto.startDate ? new Date(dto.startDate) : null }
          : {}),
        ...(dto.endDate !== undefined
          ? { endDate: dto.endDate ? new Date(dto.endDate) : null }
          : {}),
      },
      include: {
        _count: {
          select: { tasks: { where: { deletedAt: null, parentId: null } } },
        },
        tasks: {
          where: {
            deletedAt: null,
            parentId: null,
            status: TaskStatus.DONE,
          },
          select: { id: true },
        },
      },
    });
    return toCycleDto({ ...cycle, doneCount: cycle.tasks.length });
  }

  async activate(ctx: WorkspaceContext, cycleId: string): Promise<CycleDto> {
    await this.requireCycle(ctx, cycleId);
    await this.completeOtherActive(ctx.workspaceId, cycleId);

    const cycle = await this.prisma.cycle.update({
      where: { id: cycleId },
      data: { status: CycleStatus.ACTIVE },
      include: {
        _count: {
          select: { tasks: { where: { deletedAt: null, parentId: null } } },
        },
        tasks: {
          where: {
            deletedAt: null,
            parentId: null,
            status: TaskStatus.DONE,
          },
          select: { id: true },
        },
      },
    });
    return toCycleDto({ ...cycle, doneCount: cycle.tasks.length });
  }

  async complete(ctx: WorkspaceContext, cycleId: string): Promise<CycleDto> {
    await this.requireCycle(ctx, cycleId);

    const cycle = await this.prisma.cycle.update({
      where: { id: cycleId },
      data: { status: CycleStatus.COMPLETED },
      include: {
        _count: {
          select: { tasks: { where: { deletedAt: null, parentId: null } } },
        },
        tasks: {
          where: {
            deletedAt: null,
            parentId: null,
            status: TaskStatus.DONE,
          },
          select: { id: true },
        },
      },
    });
    return toCycleDto({ ...cycle, doneCount: cycle.tasks.length });
  }

  async remove(
    ctx: WorkspaceContext,
    cycleId: string,
  ): Promise<{ message: string }> {
    await this.requireCycle(ctx, cycleId);
    await this.prisma.cycle.delete({ where: { id: cycleId } });
    return { message: 'Cycle deleted' };
  }

  private async requireCycle(
    ctx: WorkspaceContext,
    cycleId: string,
  ): Promise<Cycle> {
    const cycle = await this.prisma.cycle.findFirst({
      where: { id: cycleId, workspaceId: ctx.workspaceId },
    });
    if (!cycle) {
      throw new NotFoundException('Cycle not found');
    }
    return cycle;
  }

  private async completeOtherActive(
    workspaceId: string,
    exceptId?: string,
  ): Promise<void> {
    await this.prisma.cycle.updateMany({
      where: {
        workspaceId,
        status: CycleStatus.ACTIVE,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { status: CycleStatus.COMPLETED },
    });
  }

  private assertDateOrder(
    startDate?: string | null,
    endDate?: string | null,
  ) {
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new BadRequestException('startDate must be before endDate');
    }
  }
}
