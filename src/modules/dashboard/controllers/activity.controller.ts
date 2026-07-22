import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ActivityAction } from '@prisma/client';
import { CurrentWorkspace } from '../../../common/decorators/current-workspace.decorator';
import type { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/rbac';
import { ActivityService } from '../services/activity.service';

@ApiTags('activity')
@ApiBearerAuth()
@ApiCookieAuth('access_token')
@Controller('workspaces/:slug/activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  @ApiOperation({ summary: 'Paginated workspace activity feed' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'projectSlug', required: false })
  @ApiQuery({
    name: 'action',
    required: false,
    enum: ActivityAction,
  })
  list(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('projectSlug') projectSlug?: string,
    @Query('action') action?: ActivityAction,
  ) {
    return this.activity.list(ctx, {
      cursor,
      limit: limit ? Number(limit) : undefined,
      projectSlug,
      action,
    });
  }
}
