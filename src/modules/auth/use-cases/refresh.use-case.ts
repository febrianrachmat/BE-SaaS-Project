import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { generateSecureToken, hashToken } from '../../../common/utils/crypto.util';
import { UserRepository } from '../repositories/user.repository';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { TokenService } from '../services/token.service';
import { toPublicUser, PublicUser } from '../mappers/user.mapper';

@Injectable()
export class RefreshUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokens: TokenService,
  ) {}

  async execute(
    rawRefreshToken: string | undefined,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{
    user: PublicUser;
    accessToken: string;
    refreshToken: string;
  }> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const tokenHash = hashToken(rawRefreshToken);
    const existing = await this.refreshTokens.findByHash(tokenHash);

    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Reuse detection — revoke entire family
    if (existing.revokedAt) {
      await this.refreshTokens.revokeFamily(existing.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.users.findById(existing.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const newRaw = generateSecureToken(48);
    const newToken = await this.refreshTokens.create({
      userId: user.id,
      tokenHash: hashToken(newRaw),
      familyId: existing.familyId,
      expiresAt: existing.expiresAt,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });

    await this.refreshTokens.revoke(existing.id, newToken.id);

    const accessToken = await this.tokens.signAccessToken({
      sub: user.id,
      email: user.email,
      systemRole: user.systemRole,
    });

    return {
      user: toPublicUser(user),
      accessToken,
      refreshToken: newRaw,
    };
  }
}
