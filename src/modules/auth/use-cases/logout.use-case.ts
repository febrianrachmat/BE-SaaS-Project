import { Injectable } from '@nestjs/common';
import { hashToken } from '../../../common/utils/crypto.util';
import { SecurityAuditService } from '../../../common/services/security-audit.service';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';

@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly audit: SecurityAuditService,
  ) {}

  async execute(
    rawRefreshToken: string | undefined,
    options: {
      allSessions?: boolean;
      userId?: string;
      ip?: string;
      userAgent?: string;
    } = {},
  ): Promise<{ message: string }> {
    if (options.allSessions && options.userId) {
      await this.refreshTokens.revokeAllForUser(options.userId);
      await this.audit.write({
        action: 'LOGOUT',
        actorId: options.userId,
        subjectId: options.userId,
        ip: options.ip,
        userAgent: options.userAgent,
        metadata: { allSessions: true },
      });
      return { message: 'Logged out from all sessions' };
    }

    let userId: string | undefined = options.userId;
    if (rawRefreshToken) {
      const existing = await this.refreshTokens.findByHash(
        hashToken(rawRefreshToken),
      );
      if (existing && !existing.revokedAt) {
        userId = existing.userId;
        await this.refreshTokens.revoke(existing.id);
      }
    }

    if (userId) {
      await this.audit.write({
        action: 'LOGOUT',
        actorId: userId,
        subjectId: userId,
        ip: options.ip,
        userAgent: options.userAgent,
      });
    }

    return { message: 'Logged out' };
  }
}
