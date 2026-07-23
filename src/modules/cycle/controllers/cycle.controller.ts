import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentWorkspace } from '../../../common/decorators/current-workspace.decorator';
import type { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/rbac';
import { CycleService } from '../services/cycle.service';
import {
  AddCycleTaskDto,
  CreateCycleDto,
  CycleCandidatesQueryDto,
  UpdateCycleDto,
} from '../dto/cycle.dto';

@ApiTags('cycles')
@ApiBearerAuth()
@ApiCookieAuth('access_token')
@Controller('workspaces/:slug/cycles')
export class CycleController {
  constructor(private readonly cycles: CycleService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  @ApiOperation({ summary: 'List workspace cycles / sprints' })
  list(@CurrentWorkspace() ctx: WorkspaceContext) {
    return this.cycles.list(ctx);
  }

  @Get(':cycleId/board')
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  @ApiOperation({ summary: 'Cycle board with tasks and progress' })
  board(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('cycleId') cycleId: string,
  ) {
    return this.cycles.getBoard(ctx, cycleId);
  }

  @Get(':cycleId/candidates')
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  @ApiOperation({ summary: 'Tasks that can be added to this cycle' })
  candidates(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('cycleId') cycleId: string,
    @Query() query: CycleCandidatesQueryDto,
  ) {
    return this.cycles.listCandidates(ctx, cycleId, query.q);
  }

  @Post(':cycleId/tasks')
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  @ApiOperation({ summary: 'Add a task to this cycle' })
  addTask(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('cycleId') cycleId: string,
    @Body() dto: AddCycleTaskDto,
  ) {
    return this.cycles.addTask(ctx, cycleId, dto.taskId);
  }

  @Delete(':cycleId/tasks/:taskId')
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  @ApiOperation({ summary: 'Remove a task from this cycle' })
  removeTask(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('cycleId') cycleId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.cycles.removeTask(ctx, cycleId, taskId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  @ApiOperation({ summary: 'Create a cycle' })
  create(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Body() dto: CreateCycleDto,
  ) {
    return this.cycles.create(ctx, dto);
  }

  @Patch(':cycleId')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  @ApiOperation({ summary: 'Update a cycle' })
  update(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('cycleId') cycleId: string,
    @Body() dto: UpdateCycleDto,
  ) {
    return this.cycles.update(ctx, cycleId, dto);
  }

  @Post(':cycleId/activate')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  @ApiOperation({
    summary: 'Activate a cycle (completes other ACTIVE cycles)',
  })
  activate(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('cycleId') cycleId: string,
  ) {
    return this.cycles.activate(ctx, cycleId);
  }

  @Post(':cycleId/complete')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  @ApiOperation({ summary: 'Mark a cycle as completed' })
  complete(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('cycleId') cycleId: string,
  ) {
    return this.cycles.complete(ctx, cycleId);
  }

  @Delete(':cycleId')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  @ApiOperation({ summary: 'Delete a cycle (unlinks tasks)' })
  remove(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('cycleId') cycleId: string,
  ) {
    return this.cycles.remove(ctx, cycleId);
  }
}
