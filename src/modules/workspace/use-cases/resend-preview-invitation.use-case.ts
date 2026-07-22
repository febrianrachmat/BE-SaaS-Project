import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  addDuration,
  generateSecureToken,
  hashToken,
} from '../../../common/utils/crypto.util';
import { InvitationRepository } from '../repositories/invitation.repository';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { MailService } from '../../auth/services/mail.service';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class ResendInvitationUseCase {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly workspaces: WorkspaceRepository,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    ctx: WorkspaceContext,
    actorId: string,
    invitationId: string,
  ): Promise<{
    message: string;
    email: string;
    inviteLink: string;
    expiresAt: string;
  }> {
    const row = await this.invitations.findByIdInWorkspace(
      ctx.workspaceId,
      invitationId,
    );
    if (!row || row.status !== 'PENDING') {
      throw new NotFoundException('Invitation not found');
    }

    const workspace = await this.workspaces.findById(ctx.workspaceId);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const token = generateSecureToken();
    const expiresAt = addDuration(new Date(), '7d');
    await this.invitations.refreshToken(
      row.id,
      hashToken(token),
      expiresAt,
    );

    let mailDelivered = true;
    try {
      await this.mail.sendWorkspaceInviteEmail(
        row.email,
        workspace.name,
        token,
      );
    } catch {
      mailDelivered = false;
    }

    await this.prisma.activityLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        actorId,
        action: 'INVITATION_SENT',
        metadata: { email: row.email, role: row.role, resent: true },
      },
    });

    return {
      message: mailDelivered
        ? 'Invitation resent'
        : 'Invite link refreshed. Email delivery failed — share the link instead.',
      email: row.email,
      inviteLink: this.buildInviteLink(token),
      expiresAt: expiresAt.toISOString(),
    };
  }

  private buildInviteLink(token: string): string {
    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    return `${frontendUrl}/invitations/accept?token=${token}`;
  }
}

@Injectable()
export class PreviewInvitationUseCase {
  constructor(private readonly invitations: InvitationRepository) {}

  async execute(token: string): Promise<{
    email: string;
    role: string;
    expiresAt: string;
    workspace: { name: string; slug: string };
  }> {
    if (!token || token.length < 20) {
      throw new BadRequestException('Invalid invitation token');
    }

    const invitation = await this.invitations.findValidByHash(hashToken(token));
    if (!invitation) {
      throw new BadRequestException('Invalid or expired invitation');
    }

    return {
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
      workspace: {
        name: invitation.workspace.name,
        slug: invitation.workspace.slug,
      },
    };
  }
}
