import { BadRequestException, Injectable } from '@nestjs/common';
import { hashToken } from '../../../common/utils/crypto.util';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { PasswordResetRepository } from '../repositories/password-reset.repository';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { UserRepository } from '../repositories/user.repository';
import { PasswordService } from '../services/password.service';

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    private readonly passwordResets: PasswordResetRepository,
    private readonly users: UserRepository,
    private readonly passwords: PasswordService,
    private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  async execute(dto: ResetPasswordDto): Promise<{ message: string }> {
    const record = await this.passwordResets.findValidByHash(
      hashToken(dto.token),
    );

    if (!record) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await this.passwords.hash(dto.password);
    await this.users.updatePassword(record.userId, passwordHash);
    await this.passwordResets.markUsed(record.id);
    await this.refreshTokens.revokeAllForUser(record.userId);

    return { message: 'Password updated. Please sign in again.' };
  }
}
