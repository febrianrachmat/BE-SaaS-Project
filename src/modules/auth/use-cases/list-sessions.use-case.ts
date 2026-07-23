import { Injectable } from '@nestjs/common';
import { hashToken } from '../../../common/utils/crypto.util';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';

export type SessionDto = {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

@Injectable()
export class ListSessionsUseCase {
  constructor(private readonly refreshTokens: RefreshTokenRepository) {}

  async execute(
    userId: string,
    rawRefreshToken?: string,
  ): Promise<{ sessions: SessionDto[] }> {
    const tokens = await this.refreshTokens.findActiveByUserId(userId);

    let currentFamilyId: string | null = null;
    if (rawRefreshToken) {
      const current = await this.refreshTokens.findByHash(
        hashToken(rawRefreshToken),
      );
      if (current && current.userId === userId && !current.revokedAt) {
        currentFamilyId = current.familyId;
      }
    }

    // One UI session per refresh-token family (rotation creates new rows).
    const byFamily = new Map<string, (typeof tokens)[number]>();
    for (const token of tokens) {
      const existing = byFamily.get(token.familyId);
      if (!existing || token.createdAt > existing.createdAt) {
        byFamily.set(token.familyId, token);
      }
    }

    const sessions = [...byFamily.values()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((token) => ({
        id: token.id,
        userAgent: token.userAgent,
        ip: token.ip,
        createdAt: token.createdAt.toISOString(),
        expiresAt: token.expiresAt.toISOString(),
        isCurrent: token.familyId === currentFamilyId,
      }));

    return { sessions };
  }
}
