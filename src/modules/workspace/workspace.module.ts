import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { WorkspaceController } from './controllers/workspace.controller';
import { WorkspaceRepository } from './repositories/workspace.repository';
import { WorkspaceMemberRepository } from './repositories/workspace-member.repository';
import { InvitationRepository } from './repositories/invitation.repository';
import { CreateWorkspaceUseCase } from './use-cases/create-workspace.use-case';
import { ListWorkspacesUseCase } from './use-cases/list-workspaces.use-case';
import { GetWorkspaceUseCase } from './use-cases/get-workspace.use-case';
import { UpdateWorkspaceUseCase } from './use-cases/update-workspace.use-case';
import { ArchiveWorkspaceUseCase } from './use-cases/archive-workspace.use-case';
import { DeleteWorkspaceUseCase } from './use-cases/delete-workspace.use-case';
import { ListMembersUseCase } from './use-cases/list-members.use-case';
import { InviteMemberUseCase } from './use-cases/invite-member.use-case';
import { AcceptInvitationUseCase } from './use-cases/accept-invitation.use-case';
import { UpdateMemberRoleUseCase } from './use-cases/update-member-role.use-case';
import { RemoveMemberUseCase } from './use-cases/remove-member.use-case';
import { TransferOwnershipUseCase } from './use-cases/transfer-ownership.use-case';

@Module({
  imports: [AuthModule],
  controllers: [WorkspaceController],
  providers: [
    WorkspaceRepository,
    WorkspaceMemberRepository,
    InvitationRepository,
    CreateWorkspaceUseCase,
    ListWorkspacesUseCase,
    GetWorkspaceUseCase,
    UpdateWorkspaceUseCase,
    ArchiveWorkspaceUseCase,
    DeleteWorkspaceUseCase,
    ListMembersUseCase,
    InviteMemberUseCase,
    AcceptInvitationUseCase,
    UpdateMemberRoleUseCase,
    RemoveMemberUseCase,
    TransferOwnershipUseCase,
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
  exports: [WorkspaceRepository, WorkspaceMemberRepository],
})
export class WorkspaceModule {}
