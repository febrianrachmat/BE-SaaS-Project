import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hashToken } from '../../../common/utils/crypto.util';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';

@Injectable()
export class RevokeSessionUseCase {
  constructor(private readonly refreshTokens: RefreshTokenRepository) {}

  async execute(
    userId: string,
    sessionId: string,
    rawRefreshToken?: string,
  ): Promise<{ message: string; revokedCurrent: boolean }> {
    const token = await this.refreshTokens.findByIdForUser(sessionId, userId);
    if (!token) {
      throw new NotFoundException('Session not found');
    }
    if (token.userId !== userId) {
      throw new ForbiddenException();
    }

    let revokedCurrent = false;
    if (rawRefreshToken) {
      const current = await this.refreshTokens.findByHash(
        hashToken(rawRefreshToken),
      );
      if (current && current.familyId === token.familyId) {
        revokedCurrent = true;
      }
    }

    await this.refreshTokens.revokeFamily(token.familyId);

    return {
      message: revokedCurrent
        ? 'Current session revoked'
        : 'Session revoked',
      revokedCurrent,
    };
  }
}
