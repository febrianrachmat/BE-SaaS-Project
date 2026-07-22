import { Injectable, NotFoundException } from '@nestjs/common';
import { InvitationRepository } from '../repositories/invitation.repository';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';

export type PendingInvitationDto = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: { id: string; name: string; email: string } | null;
};

@Injectable()
export class ListInvitationsUseCase {
  constructor(private readonly invitations: InvitationRepository) {}

  async execute(ctx: WorkspaceContext): Promise<PendingInvitationDto[]> {
    const rows = await this.invitations.listPending(ctx.workspaceId);
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      invitedBy: row.invitedBy
        ? {
            id: row.invitedBy.id,
            name: row.invitedBy.name,
            email: row.invitedBy.email,
          }
        : null,
    }));
  }
}

@Injectable()
export class RevokeInvitationUseCase {
  constructor(private readonly invitations: InvitationRepository) {}

  async execute(
    ctx: WorkspaceContext,
    invitationId: string,
  ): Promise<{ message: string }> {
    const row = await this.invitations.findByIdInWorkspace(
      ctx.workspaceId,
      invitationId,
    );
    if (!row || row.status !== 'PENDING') {
      throw new NotFoundException('Invitation not found');
    }
    await this.invitations.revoke(row.id);
    return { message: 'Invitation revoked' };
  }
}
