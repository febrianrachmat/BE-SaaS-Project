import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { CreateCycleDto, UpdateCycleDto } from '../dto/cycle.dto';

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
