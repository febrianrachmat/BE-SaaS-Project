import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class EmailVerificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, tokenHash: string, expiresAt: Date) {
    return this.prisma.emailVerification.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  findValidByHash(tokenHash: string) {
    return this.prisma.emailVerification.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  markUsed(id: string) {
    return this.prisma.emailVerification.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }
}
