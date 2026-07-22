import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { CurrentWorkspace } from '../../../common/decorators/current-workspace.decorator';
import type { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/rbac';
import { TemplateService } from '../services/template.service';
import {
  ApplyTemplateDto,
  CreateTemplateDto,
  CreateTemplateFromProjectDto,
} from '../dto/template.dto';

@ApiTags('templates')
@ApiBearerAuth()
@ApiCookieAuth('access_token')
@Controller('workspaces/:slug/templates')
export class TemplateController {
  constructor(private readonly templates: TemplateService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  @ApiOperation({ summary: 'List project templates' })
  list(@CurrentWorkspace() ctx: WorkspaceContext) {
    return this.templates.list(ctx);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  @ApiOperation({ summary: 'Create a project template from payload' })
  create(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.templates.create(ctx, user.id, dto);
  }

  @Post('from-project')
  @RequirePermissions(PERMISSIONS.PROJECT_CREATE)
  @ApiOperation({ summary: 'Snapshot an existing project into a template' })
  createFromProject(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTemplateFromProjectDto,
  ) {
    return this.templates.createFromProject(ctx, user.id, dto);
  }

  @Get(':templateId')
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  @ApiOperation({ summary: 'Get a project template' })
  get(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('templateId') templateId: string,
  ) {
    return this.templates.get(ctx, templateId);
  }

  @Post(':templateId/apply')
  @RequirePermissions(PERMISSIONS.PROJECT_CREATE)
  @ApiOperation({ summary: 'Create a new project from a template' })
  apply(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @CurrentUser() user: AuthUser,
    @Param('templateId') templateId: string,
    @Body() dto: ApplyTemplateDto,
  ) {
    return this.templates.apply(ctx, user.id, templateId, dto);
  }

  @Delete(':templateId')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  @ApiOperation({ summary: 'Delete a project template' })
  remove(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('templateId') templateId: string,
  ) {
    return this.templates.remove(ctx, templateId);
  }
}
