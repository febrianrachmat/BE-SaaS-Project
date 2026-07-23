import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SecurityAuditService } from '../../common/services/security-audit.service';

@Global()
@Module({
  providers: [PrismaService, SecurityAuditService],
  exports: [PrismaService, SecurityAuditService],
})
export class PrismaModule {}
