import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { WorkspaceMemberRepository } from '../repositories/workspace-member.repository';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { WORKSPACE_ROLE_RANK } from '../../../common/constants/rbac';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class RemoveMemberUseCase {
  constructor(
    private readonly members: WorkspaceMemberRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    ctx: WorkspaceContext,
    actorId: string,
    memberId: string,
  ): Promise<{ message: string }> {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId: ctx.workspaceId, deletedAt: null },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('Cannot remove the workspace owner');
    }

    if (member.userId === actorId) {
      throw new ForbiddenException('Use leave workspace to remove yourself');
    }

    if (WORKSPACE_ROLE_RANK[member.role] >= WORKSPACE_ROLE_RANK[ctx.role]) {
      throw new ForbiddenException(
        'Cannot remove a member with equal or higher rank',
      );
    }

    await this.members.softDelete(member.id);

    await this.prisma.activityLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        actorId,
        action: 'MEMBER_LEFT',
        metadata: { removedUserId: member.userId },
      },
    });

    return { message: 'Member removed' };
  }
}
