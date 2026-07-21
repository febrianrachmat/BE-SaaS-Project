import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { UpdateMemberRoleDto } from '../dto/member.dto';
import { WorkspaceMemberRepository } from '../repositories/workspace-member.repository';
import { toMemberDto, MemberDto } from '../mappers/workspace.mapper';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { WORKSPACE_ROLE_RANK } from '../../../common/constants/rbac';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class UpdateMemberRoleUseCase {
  constructor(
    private readonly members: WorkspaceMemberRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    ctx: WorkspaceContext,
    actorId: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
  ): Promise<MemberDto> {
    if (dto.role === WorkspaceRole.OWNER) {
      throw new BadRequestException('Use transfer ownership to assign OWNER');
    }

    const member = await this.prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId: ctx.workspaceId, deletedAt: null },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('Cannot change the owner role directly');
    }

    if (member.userId === actorId) {
      throw new ForbiddenException('Cannot change your own role');
    }

    if (WORKSPACE_ROLE_RANK[member.role] >= WORKSPACE_ROLE_RANK[ctx.role]) {
      throw new ForbiddenException(
        'Cannot change role of a member with equal or higher rank',
      );
    }

    if (WORKSPACE_ROLE_RANK[dto.role] >= WORKSPACE_ROLE_RANK[ctx.role]) {
      throw new ForbiddenException(
        'Cannot assign a role equal or higher than your own',
      );
    }

    const updated = await this.members.updateRole(member.id, dto.role);

    await this.prisma.activityLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        actorId,
        action: 'ROLE_CHANGED',
        metadata: {
          memberId,
          from: member.role,
          to: dto.role,
        },
      },
    });

    return toMemberDto(updated);
  }
}
