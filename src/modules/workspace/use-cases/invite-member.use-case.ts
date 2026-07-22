import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkspaceRole } from '@prisma/client';
import {
  generateSecureToken,
  hashToken,
  addDuration,
} from '../../../common/utils/crypto.util';
import { InviteMemberDto } from '../dto/invite-member.dto';
import { InvitationRepository } from '../repositories/invitation.repository';
import { WorkspaceMemberRepository } from '../repositories/workspace-member.repository';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { UserRepository } from '../../auth/repositories/user.repository';
import { MailService } from '../../auth/services/mail.service';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { WORKSPACE_ROLE_RANK } from '../../../common/constants/rbac';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class InviteMemberUseCase {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly members: WorkspaceMemberRepository,
    private readonly workspaces: WorkspaceRepository,
    private readonly users: UserRepository,
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async execute(
    ctx: WorkspaceContext,
    actorId: string,
    dto: InviteMemberDto,
  ): Promise<{
    message: string;
    email: string;
    inviteLink: string;
    invitationId: string;
    role: WorkspaceRole;
    expiresAt: string;
  }> {
    const role = dto.role ?? WorkspaceRole.MEMBER;
    if (role === WorkspaceRole.OWNER) {
      throw new BadRequestException('Cannot invite someone as OWNER');
    }

    if (WORKSPACE_ROLE_RANK[role] >= WORKSPACE_ROLE_RANK[ctx.role]) {
      throw new ForbiddenException(
        'Cannot invite a member with equal or higher role',
      );
    }

    const email = dto.email.toLowerCase().trim();
    const workspace = await this.workspaces.findById(ctx.workspaceId);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const existingUser = await this.users.findByEmail(email);
    if (existingUser) {
      const membership = await this.members.findActive(
        ctx.workspaceId,
        existingUser.id,
      );
      if (membership) {
        throw new ConflictException('User is already a workspace member');
      }
    }

    const pending = await this.invitations.findPendingByEmail(
      ctx.workspaceId,
      email,
    );
    if (pending) {
      throw new ConflictException('A pending invitation already exists');
    }

    const token = generateSecureToken();
    const expiresAt = addDuration(new Date(), '7d');
    const invitation = await this.invitations.create({
      workspaceId: ctx.workspaceId,
      email,
      role,
      tokenHash: hashToken(token),
      invitedById: actorId,
      expiresAt,
    });

    let mailDelivered = true;
    try {
      await this.mail.sendWorkspaceInviteEmail(email, workspace.name, token);
    } catch {
      mailDelivered = false;
    }

    await this.prisma.activityLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        actorId,
        action: 'INVITATION_SENT',
        metadata: { email, role },
      },
    });

    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );

    return {
      message: mailDelivered
        ? 'Invitation sent'
        : 'Invitation created. Email delivery failed — share the invite link instead.',
      email,
      inviteLink: `${frontendUrl}/invitations/accept?token=${token}`,
      invitationId: invitation.id,
      role,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
