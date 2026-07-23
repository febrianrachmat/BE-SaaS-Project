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
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { CurrentWorkspace } from '../../../common/decorators/current-workspace.decorator';
import type { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/rbac';
import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { UpdateWorkspaceDto } from '../dto/update-workspace.dto';
import { InviteMemberDto } from '../dto/invite-member.dto';
import {
  AcceptInvitationDto,
  TransferOwnershipDto,
  UpdateMemberRoleDto,
} from '../dto/member.dto';
import { CreateWorkspaceUseCase } from '../use-cases/create-workspace.use-case';
import { ListWorkspacesUseCase } from '../use-cases/list-workspaces.use-case';
import { GetWorkspaceUseCase } from '../use-cases/get-workspace.use-case';
import { UpdateWorkspaceUseCase } from '../use-cases/update-workspace.use-case';
import { ArchiveWorkspaceUseCase } from '../use-cases/archive-workspace.use-case';
import { DeleteWorkspaceUseCase } from '../use-cases/delete-workspace.use-case';
import { ListMembersUseCase } from '../use-cases/list-members.use-case';
import { InviteMemberUseCase } from '../use-cases/invite-member.use-case';
import { AcceptInvitationUseCase } from '../use-cases/accept-invitation.use-case';
import { UpdateMemberRoleUseCase } from '../use-cases/update-member-role.use-case';
import { RemoveMemberUseCase } from '../use-cases/remove-member.use-case';
import { TransferOwnershipUseCase } from '../use-cases/transfer-ownership.use-case';
import {
  ListInvitationsUseCase,
  RevokeInvitationUseCase,
} from '../use-cases/manage-invitations.use-case';
import {
  PreviewInvitationUseCase,
  ResendInvitationUseCase,
} from '../use-cases/resend-preview-invitation.use-case';
import { SecurityAuditService } from '../../../common/services/security-audit.service';

@ApiTags('workspaces')
@ApiBearerAuth()
@ApiCookieAuth('access_token')
@Controller()
export class WorkspaceController {
  constructor(
    private readonly createWorkspace: CreateWorkspaceUseCase,
    private readonly listWorkspaces: ListWorkspacesUseCase,
    private readonly getWorkspace: GetWorkspaceUseCase,
    private readonly updateWorkspace: UpdateWorkspaceUseCase,
    private readonly archiveWorkspace: ArchiveWorkspaceUseCase,
    private readonly deleteWorkspace: DeleteWorkspaceUseCase,
    private readonly listMembers: ListMembersUseCase,
    private readonly inviteMember: InviteMemberUseCase,
    private readonly acceptInvitation: AcceptInvitationUseCase,
    private readonly listInvitations: ListInvitationsUseCase,
    private readonly revokeInvitation: RevokeInvitationUseCase,
    private readonly resendInvitation: ResendInvitationUseCase,
    private readonly previewInvitation: PreviewInvitationUseCase,
    private readonly updateMemberRole: UpdateMemberRoleUseCase,
    private readonly removeMemberUseCase: RemoveMemberUseCase,
    private readonly transferOwnership: TransferOwnershipUseCase,
    private readonly audit: SecurityAuditService,
  ) {}

  @Post('workspaces')
  @ApiOperation({ summary: 'Create a workspace' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkspaceDto) {
    return this.createWorkspace.execute(user.id, dto);
  }

  @Get('workspaces')
  @ApiOperation({ summary: 'List my workspaces' })
  list(@CurrentUser() user: AuthUser) {
    return this.listWorkspaces.execute(user.id);
  }

  @Public()
  @Get('invitations/preview')
  @ApiOperation({ summary: 'Preview invitation details by token' })
  preview(@Query('token') token: string) {
    return this.previewInvitation.execute(token);
  }

  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a workspace invitation' })
  accept(
    @CurrentUser() user: AuthUser,
    @Body() dto: AcceptInvitationDto,
  ) {
    return this.acceptInvitation.execute(user.id, dto);
  }

  @Get('workspaces/:slug')
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  @ApiOperation({ summary: 'Get workspace by slug' })
  get(@CurrentWorkspace() ctx: WorkspaceContext) {
    return this.getWorkspace.execute(ctx);
  }

  @Get('workspaces/:slug/security-log')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'List workspace security audit events' })
  securityLog(@CurrentWorkspace() ctx: WorkspaceContext) {
    return this.audit.listForWorkspace(ctx.workspaceId);
  }

  @Patch('workspaces/:slug')
  @RequirePermissions(PERMISSIONS.WORKSPACE_UPDATE)
  @ApiOperation({ summary: 'Update workspace settings' })
  update(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.updateWorkspace.execute(ctx, user.id, dto);
  }

  @Post('workspaces/:slug/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.WORKSPACE_ARCHIVE)
  @ApiOperation({ summary: 'Archive workspace' })
  archive(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
  ) {
    return this.archiveWorkspace.execute(ctx, user.id, true);
  }

  @Post('workspaces/:slug/unarchive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.WORKSPACE_ARCHIVE)
  @ApiOperation({ summary: 'Unarchive workspace' })
  unarchive(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
  ) {
    return this.archiveWorkspace.execute(ctx, user.id, false);
  }

  @Delete('workspaces/:slug')
  @RequirePermissions(PERMISSIONS.WORKSPACE_DELETE)
  @ApiOperation({ summary: 'Soft-delete workspace' })
  remove(@CurrentWorkspace() ctx: WorkspaceContext) {
    return this.deleteWorkspace.execute(ctx);
  }

  @Get('workspaces/:slug/members')
  @RequirePermissions(PERMISSIONS.WORKSPACE_VIEW)
  @ApiOperation({ summary: 'List workspace members' })
  members(@CurrentWorkspace() ctx: WorkspaceContext) {
    return this.listMembers.execute(ctx);
  }

  @Get('workspaces/:slug/invitations')
  @RequirePermissions(PERMISSIONS.MEMBER_INVITE)
  @ApiOperation({ summary: 'List pending invitations' })
  invitations(@CurrentWorkspace() ctx: WorkspaceContext) {
    return this.listInvitations.execute(ctx);
  }

  @Post('workspaces/:slug/invitations')
  @RequirePermissions(PERMISSIONS.MEMBER_INVITE)
  @ApiOperation({ summary: 'Invite member by email' })
  invite(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Body() dto: InviteMemberDto,
  ) {
    return this.inviteMember.execute(ctx, user.id, dto);
  }

  @Post('workspaces/:slug/invitations/:invitationId/resend')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.MEMBER_INVITE)
  @ApiOperation({ summary: 'Resend invitation email and refresh link' })
  resend(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('invitationId') invitationId: string,
  ) {
    return this.resendInvitation.execute(ctx, user.id, invitationId);
  }

  @Delete('workspaces/:slug/invitations/:invitationId')
  @RequirePermissions(PERMISSIONS.MEMBER_INVITE)
  @ApiOperation({ summary: 'Revoke a pending invitation' })
  revoke(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('invitationId') invitationId: string,
  ) {
    return this.revokeInvitation.execute(ctx, invitationId);
  }

  @Patch('workspaces/:slug/members/:memberId')
  @RequirePermissions(PERMISSIONS.MEMBER_ROLE_CHANGE)
  @ApiOperation({ summary: 'Update member role' })
  changeRole(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.updateMemberRole.execute(ctx, user.id, memberId, dto);
  }

  @Delete('workspaces/:slug/members/:memberId')
  @RequirePermissions(PERMISSIONS.MEMBER_REMOVE)
  @ApiOperation({ summary: 'Remove member' })
  removeMember(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('memberId') memberId: string,
  ) {
    return this.removeMemberUseCase.execute(ctx, user.id, memberId);
  }

  @Post('workspaces/:slug/transfer')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.WORKSPACE_TRANSFER)
  @ApiOperation({ summary: 'Transfer workspace ownership' })
  transfer(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Body() dto: TransferOwnershipDto,
  ) {
    return this.transferOwnership.execute(ctx, user.id, dto);
  }
}
