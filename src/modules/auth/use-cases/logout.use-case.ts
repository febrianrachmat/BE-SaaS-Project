import { Injectable } from '@nestjs/common';
import { hashToken } from '../../../common/utils/crypto.util';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';

@Injectable()
export class LogoutUseCase {
  constructor(private readonly refreshTokens: RefreshTokenRepository) {}

  async execute(
    rawRefreshToken: string | undefined,
    options: { allSessions?: boolean; userId?: string } = {},
  ): Promise<{ message: string }> {
    if (options.allSessions && options.userId) {
      await this.refreshTokens.revokeAllForUser(options.userId);
      return { message: 'Logged out from all sessions' };
    }

    if (rawRefreshToken) {
      const existing = await this.refreshTokens.findByHash(
        hashToken(rawRefreshToken),
      );
      if (existing && !existing.revokedAt) {
        await this.refreshTokens.revoke(existing.id);
      }
    }

    return { message: 'Logged out' };
  }
}
