import {
  Project,
  ProjectPriority,
  ProjectStatus,
  ProjectVisibility,
  Task,
  TaskPriority,
  TaskStatus,
} from '@prisma/client';

export type ProjectDto = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  icon: string | null;
  visibility: ProjectVisibility;
  status: ProjectStatus;
  priority: ProjectPriority;
  deadline: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isFavorite?: boolean;
  taskCount?: number;
};

export type TaskUserDto = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

export type LabelDto = {
  id: string;
  name: string;
  color: string;
};

export type ChecklistItemDto = {
  id: string;
  title: string;
  isDone: boolean;
  position: number;
};

export type TaskDto = {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  storyPoints: number | null;
  estimatedMins: number | null;
  actualMins: number | null;
  dueDate: string | null;
  position: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reporter?: TaskUserDto;
  assignee?: TaskUserDto | null;
  labels?: LabelDto[];
  checklist?: ChecklistItemDto[];
  subtaskCount?: number;
};

type UserPick = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

export function toProjectDto(
  project: Project,
  extras?: { isFavorite?: boolean; taskCount?: number },
): ProjectDto {
  return {
    id: project.id,
    workspaceId: project.workspaceId,
    name: project.name,
    slug: project.slug,
    description: project.description,
    coverUrl: project.coverUrl,
    icon: project.icon,
    visibility: project.visibility,
    status: project.status,
    priority: project.priority,
    deadline: project.deadline?.toISOString() ?? null,
    archivedAt: project.archivedAt?.toISOString() ?? null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    isFavorite: extras?.isFavorite,
    taskCount: extras?.taskCount,
  };
}

export function toTaskDto(
  task: Task & {
    reporter?: UserPick;
    assignee?: UserPick | null;
    labels?: { label: LabelDto }[];
    checklist?: { id: string; title: string; isDone: boolean; position: number; deletedAt: Date | null }[];
    _count?: { subtasks: number };
  },
): TaskDto {
  return {
    id: task.id,
    projectId: task.projectId,
    parentId: task.parentId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    storyPoints: task.storyPoints,
    estimatedMins: task.estimatedMins,
    actualMins: task.actualMins,
    dueDate: task.dueDate?.toISOString() ?? null,
    position: task.position,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    reporter: task.reporter,
    assignee: task.assignee ?? null,
    labels: task.labels?.map((l) => l.label),
    checklist: task.checklist
      ?.filter((c) => !c.deletedAt)
      .map((c) => ({
        id: c.id,
        title: c.title,
        isDone: c.isDone,
        position: c.position,
      })),
    subtaskCount: task._count?.subtasks,
  };
}
