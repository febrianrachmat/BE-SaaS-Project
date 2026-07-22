import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import * as express from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { RegisterUseCase } from '../use-cases/register.use-case';
import { LoginUseCase } from '../use-cases/login.use-case';
import { RefreshUseCase } from '../use-cases/refresh.use-case';
import { LogoutUseCase } from '../use-cases/logout.use-case';
import { VerifyEmailUseCase } from '../use-cases/verify-email.use-case';
import { ForgotPasswordUseCase } from '../use-cases/forgot-password.use-case';
import { ResetPasswordUseCase } from '../use-cases/reset-password.use-case';
import { GetMeUseCase } from '../use-cases/get-me.use-case';
import { GoogleAuthUseCase } from '../use-cases/google-auth.use-case';
import { TokenService } from '../services/token.service';
import type { GoogleProfilePayload } from '../strategies/google.strategy';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly verifyEmailUseCase: VerifyEmailUseCase,
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly getMeUseCase: GetMeUseCase,
    private readonly googleAuthUseCase: GoogleAuthUseCase,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
  ) {}

  private assertGoogleConfigured(): void {
    if (
      !this.config.get<string>('GOOGLE_CLIENT_ID') ||
      !this.config.get<string>('GOOGLE_CLIENT_SECRET')
    ) {
      throw new ServiceUnavailableException(
        'Google sign-in is not configured on this server.',
      );
    }
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Start Google OAuth' })
  googleAuth(): void {
    this.assertGoogleConfigured();
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(
    @Req() req: express.Request,
    @Res() res: express.Response,
  ): Promise<void> {
    this.assertGoogleConfigured();
    const profile = req.user as GoogleProfilePayload;
    const result = await this.googleAuthUseCase.execute(profile, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    this.tokens.setAuthCookies(
      res,
      result.accessToken,
      result.refreshToken,
      result.rememberMe,
    );

    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    res.redirect(`${frontendUrl}/app?oauth=1`);
  }

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a new account' })
  async register(@Body() dto: RegisterDto) {
    return this.registerUseCase.execute(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login and set auth cookies' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const result = await this.loginUseCase.execute(dto, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    this.tokens.setAuthCookies(
      res,
      result.accessToken,
      result.refreshToken,
      result.rememberMe,
    );

    return { user: result.user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  async refresh(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const raw = cookies?.refresh_token;
    const result = await this.refreshUseCase.execute(raw, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    this.tokens.setAuthCookies(res, result.accessToken, result.refreshToken);

    return { user: result.user };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and clear cookies' })
  async logout(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const raw = cookies?.refresh_token;
    const result = await this.logoutUseCase.execute(raw);
    this.tokens.clearAuthCookies(res);
    return result;
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with token' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.verifyEmailUseCase.execute(dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.forgotPasswordUseCase.execute(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.resetPasswordUseCase.execute(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get current authenticated user' })
  async me(@CurrentUser() user: AuthUser) {
    return this.getMeUseCase.execute(user.id);
  }
}
