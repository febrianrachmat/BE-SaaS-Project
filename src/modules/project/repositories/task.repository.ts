import { Injectable } from '@nestjs/common';
import { Prisma, Task, TaskStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

const taskInclude = {
  reporter: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
  assignee: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
  cycle: {
    select: { id: true, name: true, status: true },
  },
  labels: { include: { label: true } },
  checklist: {
    where: { deletedAt: null },
    orderBy: { position: 'asc' as const },
  },
  _count: { select: { subtasks: { where: { deletedAt: null } } } },
};

@Injectable()
export class TaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.task.findFirst({
      where: { id, deletedAt: null },
      include: taskInclude,
    });
  }

  listByProject(
    projectId: string,
    filters: {
      status?: TaskStatus;
      priority?: string;
      assigneeId?: string;
      labelId?: string;
      cycleId?: string;
      q?: string;
    },
    pagination?: { skip: number; take: number },
  ) {
    return this.prisma.task.findMany({
      where: this.listWhere(projectId, filters),
      include: taskInclude,
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      ...(pagination
        ? { skip: pagination.skip, take: pagination.take }
        : {}),
    });
  }

  countByProject(
    projectId: string,
    filters: {
      status?: TaskStatus;
      priority?: string;
      assigneeId?: string;
      labelId?: string;
      cycleId?: string;
      q?: string;
    },
  ) {
    return this.prisma.task.count({
      where: this.listWhere(projectId, filters),
    });
  }

  private listWhere(
    projectId: string,
    filters: {
      status?: TaskStatus;
      priority?: string;
      assigneeId?: string;
      labelId?: string;
      cycleId?: string;
      q?: string;
    },
  ): Prisma.TaskWhereInput {
    return {
      projectId,
      deletedAt: null,
      parentId: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority
        ? {
            priority:
              filters.priority as Prisma.EnumTaskPriorityFilter['equals'],
          }
        : {}),
      ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      ...(filters.cycleId ? { cycleId: filters.cycleId } : {}),
      ...(filters.labelId
        ? { labels: { some: { labelId: filters.labelId } } }
        : {}),
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: 'insensitive' } },
              { description: { contains: filters.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  /** All non-deleted tasks including subtasks (for export). */
  listAllByProject(projectId: string) {
    return this.prisma.task.findMany({
      where: {
        projectId,
        deletedAt: null,
      },
      include: taskInclude,
      orderBy: [
        { parentId: 'asc' },
        { position: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  listSubtasks(projectId: string, parentId: string) {
    return this.prisma.task.findMany({
      where: {
        projectId,
        parentId,
        deletedAt: null,
      },
      include: taskInclude,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async nextPosition(projectId: string, status: TaskStatus): Promise<number> {
    const last = await this.prisma.task.findFirst({
      where: { projectId, status, deletedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return (last?.position ?? 0) + 1000;
  }

  create(data: Prisma.TaskCreateInput) {
    return this.prisma.task.create({ data, include: taskInclude });
  }

  update(id: string, data: Prisma.TaskUpdateInput) {
    return this.prisma.task.update({
      where: { id },
      data,
      include: taskInclude,
    });
  }

  softDelete(id: string) {
    return this.prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  restore(id: string) {
    return this.prisma.task.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  setLabels(taskId: string, labelIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.taskLabel.deleteMany({ where: { taskId } });
      if (labelIds.length) {
        await tx.taskLabel.createMany({
          data: labelIds.map((labelId) => ({ taskId, labelId })),
        });
      }
      return tx.task.findFirst({
        where: { id: taskId },
        include: taskInclude,
      });
    });
  }

  createChecklistItem(taskId: string, title: string, position: number) {
    return this.prisma.checklistItem.create({
      data: { taskId, title, position },
    });
  }

  updateChecklistItem(
    id: string,
    data: { title?: string; isDone?: boolean },
  ) {
    return this.prisma.checklistItem.update({ where: { id }, data });
  }

  softDeleteChecklistItem(id: string) {
    return this.prisma.checklistItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  findChecklistItem(id: string) {
    return this.prisma.checklistItem.findFirst({
      where: { id, deletedAt: null },
      include: { task: true },
    });
  }
}
