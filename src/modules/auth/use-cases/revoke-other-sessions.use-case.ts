import { Injectable } from '@nestjs/common';
import { hashToken } from '../../../common/utils/crypto.util';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';

@Injectable()
export class RevokeOtherSessionsUseCase {
  constructor(private readonly refreshTokens: RefreshTokenRepository) {}

  async execute(
    userId: string,
    rawRefreshToken?: string,
  ): Promise<{ message: string; revokedCountHint: 'others' | 'all' }> {
    if (!rawRefreshToken) {
      await this.refreshTokens.revokeAllForUser(userId);
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
      return {
        message: 'All sessions revoked',
        revokedCountHint: 'all',
      };
    }

    await this.refreshTokens.revokeAllExceptFamily(userId, current.familyId);
    return {
      message: 'Other sessions revoked',
      revokedCountHint: 'others',
    };
  }
}
