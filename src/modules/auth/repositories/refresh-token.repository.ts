import { Injectable } from '@nestjs/common';
import { RefreshToken } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    userAgent?: string;
    ip?: string;
  }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  findValidByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  findByIdForUser(id: string, userId: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findFirst({
      where: { id, userId },
    });
  }

  findActiveByUserId(userId: string): Promise<RefreshToken[]> {
    return this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(id: string, replacedById?: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: {
        revokedAt: new Date(),
        ...(replacedById ? { replacedById } : {}),
      },
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllExceptFamily(
    userId: string,
    keepFamilyId: string,
  ): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        NOT: { familyId: keepFamilyId },
      },
      data: { revokedAt: new Date() },
    });
  }
}
