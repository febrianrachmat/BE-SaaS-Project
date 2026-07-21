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
import { CreateProjectDto, UpdateProjectDto } from '../dto/project.dto';
import {
  CreateChecklistItemDto,
  CreateLabelDto,
  CreateTaskDto,
  TaskQueryDto,
  UpdateChecklistItemDto,
  UpdateTaskDto,
} from '../dto/task.dto';
import { ProjectService } from '../services/project.service';
import { TaskService } from '../services/task.service';

@ApiTags('projects')
@ApiBearerAuth()
@ApiCookieAuth('access_token')
@Controller('workspaces/:slug')
export class ProjectController {
  constructor(
    private readonly projects: ProjectService,
    private readonly tasks: TaskService,
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
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
  ) {
    return this.projects.remove(ctx, projectSlug);
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
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Query() query: TaskQueryDto,
  ) {
    return this.tasks.list(ctx, projectSlug, query);
  }

  @Get('projects/:projectSlug/tasks/:taskId')
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  getTask(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Param('taskId') taskId: string,
  ) {
    return this.tasks.get(ctx, projectSlug, taskId);
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
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('projectSlug') projectSlug: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateChecklistItemDto,
  ) {
    return this.tasks.addChecklist(ctx, projectSlug, taskId, dto);
  }

  @Patch('checklist/:itemId')
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  updateChecklist(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateChecklistItemDto,
  ) {
    return this.tasks.updateChecklist(ctx, itemId, dto);
  }

  @Delete('checklist/:itemId')
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  removeChecklist(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('itemId') itemId: string,
  ) {
    return this.tasks.removeChecklist(ctx, itemId);
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
}
