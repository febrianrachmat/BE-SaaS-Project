import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { ProjectRepository } from '../repositories/project.repository';
import { TaskRepository } from '../repositories/task.repository';

export type TrashProjectItem = {
  type: 'project';
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  deletedAt: string;
};

export type TrashTaskItem = {
  type: 'task';
  id: string;
  title: string;
  status: string;
  priority: string;
  deletedAt: string;
  project: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    deleted: boolean;
  };
};

@Injectable()
export class TrashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectRepository,
    private readonly tasks: TaskRepository,
  ) {}

  async list(ctx: WorkspaceContext): Promise<{
    projects: TrashProjectItem[];
    tasks: TrashTaskItem[];
  }> {
    const [projects, tasks] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          deletedAt: { not: null },
        },
        orderBy: { deletedAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          icon: true,
          deletedAt: true,
        },
      }),
      this.prisma.task.findMany({
        where: {
          deletedAt: { not: null },
          project: { workspaceId: ctx.workspaceId },
        },
        orderBy: { deletedAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          deletedAt: true,
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
              deletedAt: true,
            },
          },
        },
      }),
    ]);

    return {
      projects: projects.map((p) => ({
        type: 'project' as const,
        id: p.id,
        name: p.name,
        slug: p.slug,
        icon: p.icon,
        deletedAt: p.deletedAt!.toISOString(),
      })),
      tasks: tasks.map((t) => ({
        type: 'task' as const,
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        deletedAt: t.deletedAt!.toISOString(),
        project: {
          id: t.project.id,
          name: t.project.name,
          slug: t.project.slug,
          icon: t.project.icon,
          deleted: t.project.deletedAt != null,
        },
      })),
    };
  }

  async restoreProject(
    ctx: WorkspaceContext,
    projectSlug: string,
    actorId: string,
  ): Promise<{ message: string }> {
    const project = await this.prisma.project.findFirst({
      where: {
        workspaceId: ctx.workspaceId,
        slug: projectSlug,
        deletedAt: { not: null },
      },
    });
    if (!project) {
      throw new NotFoundException('Deleted project not found');
    }

    await this.projects.restore(project.id);

    await this.prisma.activityLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        projectId: project.id,
        actorId,
        action: 'PROJECT_UPDATED',
        metadata: { restored: true },
      },
    });

    return { message: 'Project restored' };
  }

  async restoreTask(
    ctx: WorkspaceContext,
    projectSlug: string,
    taskId: string,
    actorId: string,
  ): Promise<{ message: string }> {
    const project = await this.prisma.project.findFirst({
      where: {
        workspaceId: ctx.workspaceId,
        slug: projectSlug,
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.deletedAt) {
      throw new BadRequestException(
        'Restore the project first before restoring its tasks',
      );
    }

    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        projectId: project.id,
        deletedAt: { not: null },
      },
    });
    if (!task) {
      throw new NotFoundException('Deleted task not found');
    }

    await this.tasks.restore(task.id);

    await this.prisma.activityLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        projectId: project.id,
        taskId: task.id,
        actorId,
        action: 'TASK_UPDATED',
        metadata: { restored: true },
      },
    });

    return { message: 'Task restored' };
  }
}
