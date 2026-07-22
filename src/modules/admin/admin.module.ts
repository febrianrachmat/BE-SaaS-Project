import { Module } from '@nestjs/common';
import { AdminController } from './controllers/admin.controller';
import { AdminService } from './services/admin.service';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';

@Module({
  controllers: [AdminController],
  providers: [AdminService, SystemAdminGuard],
})
export class AdminModule {}
