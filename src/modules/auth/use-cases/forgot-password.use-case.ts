import { Injectable } from '@nestjs/common';
import {
  generateSecureToken,
  hashToken,
  addDuration,
} from '../../../common/utils/crypto.util';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { UserRepository } from '../repositories/user.repository';
import { PasswordResetRepository } from '../repositories/password-reset.repository';
import { MailService } from '../services/mail.service';

@Injectable()
export class ForgotPasswordUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordResets: PasswordResetRepository,
    private readonly mail: MailService,
  ) {}

  async execute(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.users.findByEmail(email);

    // Always return same message to prevent email enumeration
    const message =
      'If an account exists for that email, a reset link has been sent.';

    if (!user) {
      return { message };
    }

    await this.passwordResets.invalidateAllForUser(user.id);

    const token = generateSecureToken();
    await this.passwordResets.create(
      user.id,
      hashToken(token),
      addDuration(new Date(), '1h'),
    );

    await this.mail.sendPasswordResetEmail(user.email, token);

    return { message };
  }
}
