import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { generateSecureToken, hashToken } from '../../../common/utils/crypto.util';
import { SecurityAuditService } from '../../../common/services/security-audit.service';
import { LoginDto } from '../dto/login.dto';
import { UserRepository } from '../repositories/user.repository';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { PasswordService } from '../services/password.service';
import { TokenService } from '../services/token.service';
import { toPublicUser, PublicUser } from '../mappers/user.mapper';

export type AuthTokensResult = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  rememberMe: boolean;
};

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: SecurityAuditService,
  ) {}

  async execute(
    dto: LoginDto,
    meta: { userAgent?: string; ip?: string },
  ): Promise<AuthTokensResult> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.users.findByEmail(email);

    if (!user) {
      await this.audit.write({
        action: 'LOGIN_FAILED',
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { email, reason: 'unknown_user' },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.passwordHash) {
      await this.audit.write({
        action: 'LOGIN_FAILED',
        subjectId: user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { email, reason: 'oauth_only' },
      });
      throw new UnauthorizedException(
        'This account uses Google sign-in. Continue with Google instead.',
      );
    }

    const valid = await this.passwords.verify(dto.password, user.passwordHash);
    if (!valid) {
      await this.audit.write({
        action: 'LOGIN_FAILED',
        subjectId: user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { email, reason: 'bad_password' },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const rememberMe = dto.rememberMe ?? false;
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
      expiresAt: this.tokens.getRefreshExpiresAt(rememberMe),
      userAgent: meta.userAgent,
      ip: meta.ip,
    });

    await this.audit.write({
      action: 'LOGIN',
      actorId: user.id,
      subjectId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { method: 'password' },
    });

    return {
      user: toPublicUser(user),
      accessToken,
      refreshToken,
      rememberMe,
    };
  }
}
