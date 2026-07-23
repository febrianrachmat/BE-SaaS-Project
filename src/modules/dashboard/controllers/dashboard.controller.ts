import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { CurrentWorkspace } from '../../../common/decorators/current-workspace.decorator';
import type { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/rbac';
import { DashboardService } from '../services/dashboard.service';
import { MyWorkQueryDto } from '../dto/my-work-query.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@ApiCookieAuth('access_token')
@Controller('workspaces/:slug/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  @ApiOperation({ summary: 'Workspace dashboard overview & analytics' })
  getOverview(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
  ) {
    return this.dashboard.getOverview(ctx, user.id);
  }

  @Get('my-work')
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  @ApiOperation({ summary: 'Tasks assigned to the current user' })
  getMyWork(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Query() query: MyWorkQueryDto,
  ) {
    return this.dashboard.getMyWork(ctx, user.id, {
      status: query.status,
      priority: query.priority,
      q: query.q,
      includeDone: query.includeDone === 'true' || query.includeDone === true,
      page: query.page,
      limit: query.limit,
    });
  }
}
