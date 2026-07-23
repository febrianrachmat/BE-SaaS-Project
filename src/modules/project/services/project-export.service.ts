import { Injectable } from '@nestjs/common';
import { ProjectService } from './project.service';
import { TaskRepository } from '../repositories/task.repository';
import { toTaskDto, type TaskDto } from '../mappers/project.mapper';
import type { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import type { ProjectDto } from '../mappers/project.mapper';

export type ExportFormat = 'csv' | 'json';

export type ProjectExportPayload = {
  project: ProjectDto;
  tasks: TaskDto[];
  exportedAt: string;
};

@Injectable()
export class ProjectExportService {
  constructor(
    private readonly projects: ProjectService,
    private readonly tasks: TaskRepository,
  ) {}

  async build(
    ctx: WorkspaceContext,
    projectSlug: string,
    userId: string,
  ): Promise<{
    payload: ProjectExportPayload;
    filenameBase: string;
  }> {
    const project = await this.projects.requireAccessibleProject(
      ctx,
      projectSlug,
      userId,
    );
    const projectDto = await this.projects.get(ctx, projectSlug, userId);
    const rows = await this.tasks.listAllByProject(project.id);
    const tasks = rows.map(toTaskDto);

    return {
      payload: {
        project: projectDto,
        tasks,
        exportedAt: new Date().toISOString(),
      },
      filenameBase: `${project.slug}-export`,
    };
  }

  toCsv(payload: ProjectExportPayload): string {
    const headers = [
      'id',
      'parentId',
      'title',
      'status',
      'priority',
      'assigneeName',
      'assigneeEmail',
      'dueDate',
      'labels',
      'cycle',
      'storyPoints',
      'estimatedMins',
      'actualMins',
      'completedAt',
      'createdAt',
      'updatedAt',
    ];

    const lines = [headers.join(',')];
    for (const task of payload.tasks) {
      lines.push(
        [
          task.id,
          task.parentId ?? '',
          task.title,
          task.status,
          task.priority,
          task.assignee?.name ?? '',
          task.assignee?.email ?? '',
          task.dueDate ?? '',
          (task.labels ?? []).map((l) => l.name).join('; '),
          task.cycle?.name ?? '',
          task.storyPoints ?? '',
          task.estimatedMins ?? '',
          task.actualMins ?? '',
          task.completedAt ?? '',
          task.createdAt,
          task.updatedAt,
        ]
          .map(csvEscape)
          .join(','),
      );
    }
    return `${lines.join('\n')}\n`;
  }
}

function csvEscape(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}
