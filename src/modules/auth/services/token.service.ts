import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Response, CookieOptions } from 'express';
import { addDuration } from '../../../common/utils/crypto.util';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  systemRole: string;
};

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signAccessToken(payload: AccessTokenPayload): Promise<string> {
    const expiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
  }

  getRefreshExpiresAt(rememberMe = false): Date {
    const duration = rememberMe
      ? this.config.get<string>('JWT_REFRESH_REMEMBER_EXPIRES_IN', '30d')
      : this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    return addDuration(new Date(), duration);
  }

  getCookieOptions(maxAgeMs: number): CookieOptions {
    const secure = this.config.get<string>('COOKIE_SECURE') === 'true';
    const sameSite = (this.config.get<string>('COOKIE_SAME_SITE', 'lax') ||
      'lax') as CookieOptions['sameSite'];

    return {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      maxAge: maxAgeMs,
    };
  }

  setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    rememberMe = false,
  ): void {
    const accessMs = 15 * 60 * 1000;
    const refreshMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

    res.cookie('access_token', accessToken, this.getCookieOptions(accessMs));
    res.cookie(
      'refresh_token',
      refreshToken,
      this.getCookieOptions(refreshMs),
    );
  }

  clearAuthCookies(res: Response): void {
    const base = this.getCookieOptions(0);
    res.clearCookie('access_token', { ...base, maxAge: undefined });
    res.clearCookie('refresh_token', { ...base, maxAge: undefined });
  }
}
