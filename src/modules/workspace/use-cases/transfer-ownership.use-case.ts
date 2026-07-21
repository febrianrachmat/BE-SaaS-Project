import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { TransferOwnershipDto } from '../dto/member.dto';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { WorkspaceMemberRepository } from '../repositories/workspace-member.repository';
import { toWorkspaceDto, WorkspaceDto } from '../mappers/workspace.mapper';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class TransferOwnershipUseCase {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly members: WorkspaceMemberRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    ctx: WorkspaceContext,
    actorId: string,
    dto: TransferOwnershipDto,
  ): Promise<WorkspaceDto> {
    if (dto.newOwnerId === actorId) {
      throw new BadRequestException('You are already the owner');
    }

    const newOwnerMembership = await this.members.findActive(
      ctx.workspaceId,
      dto.newOwnerId,
    );
    if (!newOwnerMembership) {
      throw new NotFoundException('New owner must be a workspace member');
    }

    const currentOwnerMembership = await this.members.findActive(
      ctx.workspaceId,
      actorId,
    );
    if (!currentOwnerMembership || currentOwnerMembership.role !== 'OWNER') {
      throw new BadRequestException('Only the current owner can transfer');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workspaceMember.update({
        where: { id: currentOwnerMembership.id },
        data: { role: WorkspaceRole.ADMIN },
      });
      await tx.workspaceMember.update({
        where: { id: newOwnerMembership.id },
        data: { role: WorkspaceRole.OWNER },
      });
      await tx.workspace.update({
        where: { id: ctx.workspaceId },
        data: { ownerId: dto.newOwnerId },
      });
      await tx.activityLog.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorId,
          action: 'ROLE_CHANGED',
          metadata: {
            type: 'ownership_transfer',
            newOwnerId: dto.newOwnerId,
          },
        },
      });
    });

    const workspace = await this.workspaces.findById(ctx.workspaceId);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const memberCount = await this.workspaces.countMembers(workspace.id);
    return toWorkspaceDto(workspace, {
      role: WorkspaceRole.ADMIN,
      memberCount,
    });
  }
}
