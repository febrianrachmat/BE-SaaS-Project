import { Injectable } from '@nestjs/common';
import { hashToken } from '../../../common/utils/crypto.util';
import { SecurityAuditService } from '../../../common/services/security-audit.service';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';

@Injectable()
export class RevokeOtherSessionsUseCase {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly audit: SecurityAuditService,
  ) {}

  async execute(
    userId: string,
    rawRefreshToken?: string,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<{ message: string; revokedCountHint: 'others' | 'all' }> {
    if (!rawRefreshToken) {
      await this.refreshTokens.revokeAllForUser(userId);
      await this.audit.write({
        action: 'SESSIONS_REVOKED_OTHERS',
        actorId: userId,
        subjectId: userId,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        metadata: { revokedCountHint: 'all' },
      });
      return {
        message: 'All sessions revoked',
        revokedCountHint: 'all',
      };
    }

    const current = await this.refreshTokens.findByHash(
      hashToken(rawRefreshToken),
    );

    if (!current || current.userId !== userId || current.revokedAt) {
      await this.refreshTokens.revokeAllForUser(userId);
      await this.audit.write({
        action: 'SESSIONS_REVOKED_OTHERS',
        actorId: userId,
        subjectId: userId,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        metadata: { revokedCountHint: 'all' },
      });
      return {
        message: 'All sessions revoked',
        revokedCountHint: 'all',
      };
    }

    await this.refreshTokens.revokeAllExceptFamily(userId, current.familyId);
    await this.audit.write({
      action: 'SESSIONS_REVOKED_OTHERS',
      actorId: userId,
      subjectId: userId,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { revokedCountHint: 'others' },
    });
    return {
      message: 'Other sessions revoked',
      revokedCountHint: 'others',
    };
  }
}
