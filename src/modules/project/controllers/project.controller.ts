import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { CurrentWorkspace } from '../../../common/decorators/current-workspace.decorator';
import type { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/rbac';
import { CreateProjectDto, UpdateProjectDto, AddProjectMemberDto } from '../dto/project.dto';
import {
  BulkTaskActionDto,
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
import { CreateShareLinkDto } from '../dto/share-link.dto';
import { ProjectService } from '../services/project.service';
import { ShareLinkService } from '../services/share-link.service';
import { TaskService } from '../services/task.service';

@ApiTags('projects')
@ApiBearerAuth()
@ApiCookieAuth('access_token')
@Controller('workspaces/:slug')
export class ProjectController {
  constructor(
    private readonly projects: ProjectService,
    private readonly tasks: TaskService,
    private readonly shareLinks: ShareLinkService,
  ) {}

  @Post('projects')
  @RequirePermissions(PERMISSIONS.PROJECT_CREATE)
  @ApiOperation({ summary: 'Create project' })
  createProject(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projects.create(ctx, user.id, dto);
  }

  @Post('projects/sample')
  @RequirePermissions(PERMISSIONS.PROJECT_CREATE)
  @ApiOperation({ summary: 'Create sample Getting Started project' })
  createSampleProject(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
  ) {
    return this.projects.createSample(ctx, user.id);
  }

  @Get('projects')
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  @ApiOperation({ summary: 'List projects' })
  listProjects(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
  ) {
    return this.projects.list(ctx, user.id);
  }

  @Get('projects/:projectSlug')
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  @ApiOperation({ summary: 'Get project' })
  getProject(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
  ) {
    return this.projects.get(ctx, projectSlug, user.id);
  }

  @Patch('projects/:projectSlug')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  @ApiOperation({ summary: 'Update project' })
  updateProject(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(ctx, projectSlug, user.id, dto);
  }

  @Post('projects/:projectSlug/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PROJECT_ARCHIVE)
  archive(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
  ) {
    return this.projects.archive(ctx, projectSlug, user.id, true);
  }

  @Post('projects/:projectSlug/unarchive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PROJECT_ARCHIVE)
  unarchive(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
  ) {
    return this.projects.archive(ctx, projectSlug, user.id, false);
  }

  @Post('projects/:projectSlug/favorite')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  favorite(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
  ) {
    return this.projects.toggleFavorite(ctx, projectSlug, user.id);
  }

  @Delete('projects/:projectSlug')
  @RequirePermissions(PERMISSIONS.PROJECT_DELETE)
  deleteProject(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
  ) {
    return this.projects.remove(ctx, projectSlug, user.id);
  }

  @Get('projects/:projectSlug/members')
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  listProjectMembers(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
  ) {
    return this.projects.listMembers(ctx, projectSlug, user.id);
  }

  @Post('projects/:projectSlug/members')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  addProjectMember(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Body() dto: AddProjectMemberDto,
  ) {
    return this.projects.addMember(ctx, projectSlug, user.id, dto.userId);
  }

  @Delete('projects/:projectSlug/members/:memberId')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  removeProjectMember(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Param('memberId') memberId: string,
  ) {
    return this.projects.removeMember(ctx, projectSlug, user.id, memberId);
  }

  @Post('projects/:projectSlug/tasks')
  @RequirePermissions(PERMISSIONS.TASK_CREATE)
  createTask(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.create(ctx, projectSlug, user.id, dto);
  }

  @Get('projects/:projectSlug/tasks')
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  listTasks(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Query() query: TaskQueryDto,
  ) {
    return this.tasks.list(ctx, projectSlug, query, user.id);
  }

  @Get('projects/:projectSlug/tasks/:taskId')
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  getTask(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Param('taskId') taskId: string,
  ) {
    return this.tasks.get(ctx, projectSlug, taskId, user.id);
  }

  @Get('projects/:projectSlug/tasks/:taskId/subtasks')
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  listSubtasks(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Param('taskId') taskId: string,
  ) {
    return this.tasks.listSubtasks(ctx, projectSlug, taskId, user.id);
  }

  @Post('projects/:projectSlug/tasks/bulk')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  @ApiOperation({ summary: 'Bulk update or delete tasks' })
  bulkTasks(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Body() dto: BulkTaskActionDto,
  ) {
    return this.tasks.bulk(ctx, projectSlug, user.id, dto);
  }

  @Patch('projects/:projectSlug/tasks/:taskId')
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  updateTask(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(ctx, projectSlug, taskId, user.id, dto);
  }

  @Post('projects/:projectSlug/tasks/:taskId/move')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  @ApiOperation({ summary: 'Move task on Kanban (status + position)' })
  moveTask(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Param('taskId') taskId: string,
    @Body() dto: MoveTaskDto,
  ) {
    return this.tasks.move(ctx, projectSlug, taskId, user.id, dto);
  }

  @Get('calendar')
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  @ApiOperation({ summary: 'List tasks with due dates in range' })
  calendar(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Query() query: CalendarQueryDto,
  ) {
    return this.tasks.calendar(ctx, query, user.id);
  }

  @Get('roadmap')
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  @ApiOperation({ summary: 'List tasks for roadmap/timeline view' })
  roadmap(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Query() query: RoadmapQueryDto,
  ) {
    return this.tasks.roadmap(ctx, query, user.id);
  }

  @Get('projects/:projectSlug/tasks/:taskId/dependencies')
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  @ApiOperation({ summary: 'List task dependencies' })
  listDependencies(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Param('taskId') taskId: string,
  ) {
    return this.tasks.listDependencies(ctx, projectSlug, taskId, user.id);
  }

  @Post('projects/:projectSlug/tasks/:taskId/dependencies')
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  @ApiOperation({ summary: 'Add task dependency' })
  addDependency(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateTaskDependencyDto,
  ) {
    return this.tasks.addDependency(ctx, projectSlug, taskId, user.id, dto);
  }

  @Delete('dependencies/:dependencyId')
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  @ApiOperation({ summary: 'Remove task dependency' })
  removeDependency(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('dependencyId') dependencyId: string,
  ) {
    return this.tasks.removeDependency(ctx, dependencyId, user.id);
  }

  @Delete('projects/:projectSlug/tasks/:taskId')
  @RequirePermissions(PERMISSIONS.TASK_DELETE)
  deleteTask(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Param('taskId') taskId: string,
  ) {
    return this.tasks.remove(ctx, projectSlug, taskId, user.id);
  }

  @Post('projects/:projectSlug/tasks/:taskId/checklist')
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  addChecklist(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateChecklistItemDto,
  ) {
    return this.tasks.addChecklist(ctx, projectSlug, taskId, user.id, dto);
  }

  @Patch('checklist/:itemId')
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  updateChecklist(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateChecklistItemDto,
  ) {
    return this.tasks.updateChecklist(ctx, itemId, user.id, dto);
  }

  @Delete('checklist/:itemId')
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  removeChecklist(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('itemId') itemId: string,
  ) {
    return this.tasks.removeChecklist(ctx, itemId, user.id);
  }

  @Get('labels')
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  listLabels(@CurrentWorkspace() ctx: WorkspaceContext) {
    return this.tasks.listLabels(ctx);
  }

  @Post('labels')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  createLabel(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Body() dto: CreateLabelDto,
  ) {
    return this.tasks.createLabel(ctx, dto);
  }

  @Patch('labels/:labelId')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  updateLabel(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('labelId') labelId: string,
    @Body() dto: UpdateLabelDto,
  ) {
    return this.tasks.updateLabel(ctx, labelId, dto);
  }

  @Delete('labels/:labelId')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  deleteLabel(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('labelId') labelId: string,
  ) {
    return this.tasks.deleteLabel(ctx, labelId);
  }

  @Get('projects/:projectSlug/share-links')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  @ApiOperation({ summary: 'List project share links' })
  listShareLinks(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
  ) {
    return this.shareLinks.list(ctx, projectSlug, user.id);
  }

  @Post('projects/:projectSlug/share-links')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  @ApiOperation({ summary: 'Create a read-only project share link' })
  createShareLink(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Body() dto: CreateShareLinkDto,
  ) {
    return this.shareLinks.create(
      ctx,
      projectSlug,
      user.id,
      dto.expiresInDays,
    );
  }

  @Delete('projects/:projectSlug/share-links/:linkId')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  @ApiOperation({ summary: 'Revoke a project share link' })
  revokeShareLink(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Param('linkId') linkId: string,
  ) {
    return this.shareLinks.revoke(ctx, projectSlug, linkId, user.id);
  }
}
