import { ConflictException, Injectable } from '@nestjs/common';
import {
  generateSecureToken,
  hashToken,
  addDuration,
} from '../../../common/utils/crypto.util';
import { RegisterDto } from '../dto/register.dto';
import { UserRepository } from '../repositories/user.repository';
import { EmailVerificationRepository } from '../repositories/email-verification.repository';
import { PasswordService } from '../services/password.service';
import { MailService } from '../services/mail.service';
import { toPublicUser, PublicUser } from '../mappers/user.mapper';

@Injectable()
export class RegisterUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly emailVerifications: EmailVerificationRepository,
    private readonly passwords: PasswordService,
    private readonly mail: MailService,
  ) {}

  async execute(
    dto: RegisterDto,
  ): Promise<{ user: PublicUser; message: string }> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.users.findByEmail(email);

    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.users.create({
      email,
      name: dto.name.trim(),
      passwordHash,
      notificationPrefs: { create: {} },
    });

    const token = generateSecureToken();
    await this.emailVerifications.create(
      user.id,
      hashToken(token),
      addDuration(new Date(), '24h'),
    );

    if (this.mail.isConfigured()) {
      await this.mail.sendVerificationEmail(user.email, token);
      return {
        user: toPublicUser(user),
        message: 'Account created. Please verify your email.',
      };
    }

    // No SMTP configured — auto-verify so production login works without inbox.
    const verified = await this.users.markEmailVerified(user.id);
    this.mail.logDevVerificationLink(user.email, token);

    return {
      user: toPublicUser(verified),
      message: 'Account created. You can sign in now.',
    };
  }
}
