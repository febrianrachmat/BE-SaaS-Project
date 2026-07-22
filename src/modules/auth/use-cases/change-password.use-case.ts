import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { UserRepository } from '../repositories/user.repository';
import { PasswordService } from '../services/password.service';

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly passwords: PasswordService,
  ) {}

  async execute(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.passwordHash) {
      throw new BadRequestException(
        'This account uses Google sign-in and has no password to change.',
      );
    }

    const ok = await this.passwords.verify(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!ok) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.users.updatePassword(userId, passwordHash);

    return { message: 'Password updated' };
  }
}
