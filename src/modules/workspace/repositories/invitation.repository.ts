import { Injectable } from '@nestjs/common';
import { InvitationStatus, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class InvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    workspaceId: string;
    email: string;
    role: WorkspaceRole;
    tokenHash: string;
    invitedById: string;
    expiresAt: Date;
  }) {
    return this.prisma.invitation.create({ data });
  }

  findPendingByEmail(workspaceId: string, email: string) {
    return this.prisma.invitation.findFirst({
      where: {
        workspaceId,
        email,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });
  }

  findValidByHash(tokenHash: string) {
    return this.prisma.invitation.findFirst({
      where: {
        tokenHash,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      include: { workspace: true },
    });
  }

  listPending(workspaceId: string) {
    return this.prisma.invitation.findMany({
      where: {
        workspaceId,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  markAccepted(id: string) {
    return this.prisma.invitation.update({
      where: { id },
      data: {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });
  }

  revoke(id: string) {
    return this.prisma.invitation.update({
      where: { id },
      data: { status: InvitationStatus.REVOKED },
    });
  }
}
