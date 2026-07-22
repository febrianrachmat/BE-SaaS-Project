import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';

export type GoogleProfilePayload = {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    const clientID =
      config.get<string>('GOOGLE_CLIENT_ID')?.trim() || 'unconfigured';
    const clientSecret =
      config.get<string>('GOOGLE_CLIENT_SECRET')?.trim() || 'unconfigured';
    super({
      clientID,
      clientSecret,
      callbackURL: config.get<string>(
        'GOOGLE_CALLBACK_URL',
        'http://localhost:4000/v1/auth/google/callback',
      ),
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value?.toLowerCase().trim();
    if (!email || !profile.id) {
      done(new Error('Google account did not return an email'), undefined);
      return;
    }

    const payload: GoogleProfilePayload = {
      googleId: profile.id,
      email,
      name: profile.displayName?.trim() || email.split('@')[0],
      avatarUrl: profile.photos?.[0]?.value,
    };

    done(null, payload);
  }
}
