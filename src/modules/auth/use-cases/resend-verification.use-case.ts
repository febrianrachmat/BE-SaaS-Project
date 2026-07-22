import { Injectable } from '@nestjs/common';
import {
  addDuration,
  generateSecureToken,
  hashToken,
} from '../../../common/utils/crypto.util';
import { ResendVerificationDto } from '../dto/resend-verification.dto';
import { EmailVerificationRepository } from '../repositories/email-verification.repository';
import { UserRepository } from '../repositories/user.repository';
import { MailService } from '../services/mail.service';

@Injectable()
export class ResendVerificationUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly emailVerifications: EmailVerificationRepository,
    private readonly mail: MailService,
  ) {}

  async execute(dto: ResendVerificationDto): Promise<{ message: string }> {
    const message =
      'If an unverified account exists for that email, a new verification link has been sent.';
    const email = dto.email.toLowerCase().trim();
    const user = await this.users.findByEmail(email);

    if (!user || user.emailVerifiedAt || !this.mail.isConfigured()) {
      return { message };
    }

    // Google-only accounts are already verified at signup.
    if (!user.passwordHash) {
      return { message };
    }

    const token = generateSecureToken();
    await this.emailVerifications.create(
      user.id,
      hashToken(token),
      addDuration(new Date(), '24h'),
    );
    await this.mail.sendVerificationEmail(user.email, token);

    return { message };
  }
}
