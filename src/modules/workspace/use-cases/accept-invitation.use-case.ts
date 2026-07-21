import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hashToken } from '../../../common/utils/crypto.util';
import { AcceptInvitationDto } from '../dto/member.dto';
import { InvitationRepository } from '../repositories/invitation.repository';
import { WorkspaceMemberRepository } from '../repositories/workspace-member.repository';
import { UserRepository } from '../../auth/repositories/user.repository';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { toWorkspaceDto, WorkspaceDto } from '../mappers/workspace.mapper';

@Injectable()
export class AcceptInvitationUseCase {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly members: WorkspaceMemberRepository,
    private readonly users: UserRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    userId: string,
    dto: AcceptInvitationDto,
  ): Promise<{ workspace: WorkspaceDto; message: string }> {
    const invitation = await this.invitations.findValidByHash(
      hashToken(dto.token),
    );
    if (!invitation) {
      throw new BadRequestException('Invalid or expired invitation');
    }

    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new BadRequestException(
        'This invitation was sent to a different email address',
      );
    }

    const existing = await this.members.findActive(
      invitation.workspaceId,
      userId,
    );
    if (existing) {
      await this.invitations.markAccepted(invitation.id);
      throw new ConflictException('You are already a member of this workspace');
    }

    await this.members.create(
      invitation.workspaceId,
      userId,
      invitation.role,
    );
    await this.invitations.markAccepted(invitation.id);
    await this.prisma.activityLog.create({
      data: {
        workspaceId: invitation.workspaceId,
        actorId: userId,
        action: 'MEMBER_JOINED',
        metadata: { role: invitation.role },
      },
    });

    return {
      workspace: toWorkspaceDto(invitation.workspace, {
        role: invitation.role,
      }),
      message: 'Invitation accepted',
    };
  }
}
