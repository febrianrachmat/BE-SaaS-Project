import { Injectable } from '@nestjs/common';
import { User, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { googleId, deletedAt: null },
    });
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  linkGoogleAccount(
    userId: string,
    data: { googleId: string; avatarUrl?: string },
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        googleId: data.googleId,
        avatarUrl: data.avatarUrl,
        emailVerifiedAt: new Date(),
      },
    });
  }

  markEmailVerified(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  updatePassword(userId: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}
