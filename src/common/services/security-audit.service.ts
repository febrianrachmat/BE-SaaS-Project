import { Injectable } from '@nestjs/common';
import { Prisma, SecurityAuditAction } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export type SecurityAuditWriteInput = {
  action: SecurityAuditAction;
  actorId?: string | null;
  subjectId?: string | null;
  workspaceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
};

const ACCOUNT_ACTIONS: SecurityAuditAction[] = [
  'LOGIN',
  'LOGIN_FAILED',
  'LOGOUT',
  'SESSION_REVOKED',
  'SESSIONS_REVOKED_OTHERS',
  'PASSWORD_CHANGED',
];

@Injectable()
export class SecurityAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async write(input: SecurityAuditWriteInput): Promise<void> {
    try {
      await this.prisma.securityAuditLog.create({
        data: {
          action: input.action,
          actorId: input.actorId ?? null,
          subjectId: input.subjectId ?? null,
          workspaceId: input.workspaceId ?? null,
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
          metadata: input.metadata ?? undefined,
        },
      });
    } catch {
      // Never fail the primary action because audit write failed
    }
  }

  private mapRow(r: {
    id: string;
    action: SecurityAuditAction;
    ip: string | null;
    userAgent: string | null;
    metadata: Prisma.JsonValue;
    createdAt: Date;
    workspaceId: string | null;
    actor: { id: string; name: string; email: string } | null;
    subject: { id: string; name: string; email: string } | null;
  }) {
    return {
      id: r.id,
      action: r.action,
      ip: r.ip,
      userAgent: r.userAgent,
      metadata: r.metadata,
      createdAt: r.createdAt.toISOString(),
      actor: r.actor,
      subject: r.subject,
      workspaceId: r.workspaceId,
    };
  }

  async listForUser(userId: string, limit = 50) {
    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await this.prisma.securityAuditLog.findMany({
      where: {
        action: { in: ACCOUNT_ACTIONS },
        OR: [{ actorId: userId }, { subjectId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        actor: { select: { id: true, name: true, email: true } },
        subject: { select: { id: true, name: true, email: true } },
      },
    });

    return rows.map((r) => this.mapRow(r));
  }

  async listForWorkspace(workspaceId: string, limit = 50) {
    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await this.prisma.securityAuditLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        actor: { select: { id: true, name: true, email: true } },
        subject: { select: { id: true, name: true, email: true } },
      },
    });

    return rows.map((r) => this.mapRow(r));
  }
}
