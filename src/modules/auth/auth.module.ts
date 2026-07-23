import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './controllers/auth.controller';
import { PasswordService } from './services/password.service';
import { MailService } from './services/mail.service';
import { MailOutboxService } from './services/mail-outbox.service';
import { TokenService } from './services/token.service';
import { UserRepository } from './repositories/user.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { EmailVerificationRepository } from './repositories/email-verification.repository';
import { PasswordResetRepository } from './repositories/password-reset.repository';
import { RegisterUseCase } from './use-cases/register.use-case';
import { LoginUseCase } from './use-cases/login.use-case';
import { RefreshUseCase } from './use-cases/refresh.use-case';
import { LogoutUseCase } from './use-cases/logout.use-case';
import { VerifyEmailUseCase } from './use-cases/verify-email.use-case';
import { ResendVerificationUseCase } from './use-cases/resend-verification.use-case';
import { ForgotPasswordUseCase } from './use-cases/forgot-password.use-case';
import { ResetPasswordUseCase } from './use-cases/reset-password.use-case';
import { GetMeUseCase } from './use-cases/get-me.use-case';
import { UpdateProfileUseCase } from './use-cases/update-profile.use-case';
import { ChangePasswordUseCase } from './use-cases/change-password.use-case';
import { GoogleAuthUseCase } from './use-cases/google-auth.use-case';
import { UploadAvatarUseCase } from './use-cases/upload-avatar.use-case';
import { NotificationPrefsService } from './services/notification-prefs.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    PasswordService,
    MailService,
    MailOutboxService,
    TokenService,
    NotificationPrefsService,
    UserRepository,
    RefreshTokenRepository,
    EmailVerificationRepository,
    PasswordResetRepository,
    RegisterUseCase,
    LoginUseCase,
    RefreshUseCase,
    LogoutUseCase,
    VerifyEmailUseCase,
    ResendVerificationUseCase,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,
    GetMeUseCase,
    UpdateProfileUseCase,
    ChangePasswordUseCase,
    GoogleAuthUseCase,
    UploadAvatarUseCase,
    JwtStrategy,
    GoogleStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [
    TokenService,
    UserRepository,
    MailService,
    MailOutboxService,
    NotificationPrefsService,
  ],
})
export class AuthModule {}
