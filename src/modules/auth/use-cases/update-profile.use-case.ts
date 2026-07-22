import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UserRepository } from '../repositories/user.repository';
import { toPublicUser, PublicUser } from '../mappers/user.mapper';

@Injectable()
export class UpdateProfileUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    const existing = await this.users.findById(userId);
    if (!existing) {
      throw new UnauthorizedException('User not found');
    }

    const user = await this.users.updateProfile(userId, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.bio !== undefined
        ? { bio: dto.bio.trim() === '' ? null : dto.bio.trim() }
        : {}),
      ...(dto.avatarUrl !== undefined
        ? {
            avatarUrl:
              dto.avatarUrl === '' || dto.avatarUrl === null
                ? null
                : dto.avatarUrl,
          }
        : {}),
      ...(dto.timezone !== undefined ? { timezone: dto.timezone.trim() } : {}),
      ...(dto.locale !== undefined ? { locale: dto.locale.trim() } : {}),
      ...(dto.theme !== undefined ? { theme: dto.theme } : {}),
    });

    return toPublicUser(user);
  }
}
