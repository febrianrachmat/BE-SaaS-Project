import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hashToken } from '../../../common/utils/crypto.util';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { EmailVerificationRepository } from '../repositories/email-verification.repository';
import { UserRepository } from '../repositories/user.repository';
import { toPublicUser, PublicUser } from '../mappers/user.mapper';

@Injectable()
export class VerifyEmailUseCase {
  constructor(
    private readonly emailVerifications: EmailVerificationRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(dto: VerifyEmailDto): Promise<{ user: PublicUser; message: string }> {
    const record = await this.emailVerifications.findValidByHash(
      hashToken(dto.token),
    );

    if (!record) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    const user = await this.users.findById(record.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerifiedAt) {
      await this.emailVerifications.markUsed(record.id);
      return {
        user: toPublicUser(user),
        message: 'Email already verified',
      };
    }

    const updated = await this.users.markEmailVerified(user.id);
    await this.emailVerifications.markUsed(record.id);

    return {
      user: toPublicUser(updated),
      message: 'Email verified successfully',
    };
  }
}
