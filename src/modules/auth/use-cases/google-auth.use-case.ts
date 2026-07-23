import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { generateSecureToken, hashToken } from '../../../common/utils/crypto.util';
import { SecurityAuditService } from '../../../common/services/security-audit.service';
import { UserRepository } from '../repositories/user.repository';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { TokenService } from '../services/token.service';
import { toPublicUser } from '../mappers/user.mapper';
import type { GoogleProfilePayload } from '../strategies/google.strategy';
import type { AuthTokensResult } from './login.use-case';

@Injectable()
export class GoogleAuthUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokens: TokenService,
    private readonly audit: SecurityAuditService,
  ) {}

  async execute(
    profile: GoogleProfilePayload,
    meta: { userAgent?: string; ip?: string },
  ): Promise<AuthTokensResult> {
    let user = await this.users.findByGoogleId(profile.googleId);

    if (!user) {
      const existing = await this.users.findByEmail(profile.email);
      if (existing) {
        user = await this.users.linkGoogleAccount(existing.id, {
          googleId: profile.googleId,
          avatarUrl: profile.avatarUrl ?? existing.avatarUrl ?? undefined,
        });
      } else {
        user = await this.users.create({
          email: profile.email,
          name: profile.name,
          googleId: profile.googleId,
          avatarUrl: profile.avatarUrl,
          emailVerifiedAt: new Date(),
          notificationPrefs: { create: {} },
        });
      }
    } else if (!user.emailVerifiedAt) {
      user = await this.users.markEmailVerified(user.id);
    }

    const accessToken = await this.tokens.signAccessToken({
      sub: user.id,
      email: user.email,
      systemRole: user.systemRole,
    });

    const refreshToken = generateSecureToken(48);
    await this.refreshTokens.create({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      familyId: randomUUID(),
      expiresAt: this.tokens.getRefreshExpiresAt(false),
      userAgent: meta.userAgent,
      ip: meta.ip,
    });

    await this.audit.write({
      action: 'LOGIN',
      actorId: user.id,
      subjectId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { method: 'google' },
    });

    return {
      user: toPublicUser(user),
      accessToken,
      refreshToken,
      rememberMe: false,
    };
  }
}
