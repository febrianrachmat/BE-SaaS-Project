import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import {
  RequireSystemAdmin,
  SystemAdminGuard,
} from '../../../common/guards/system-admin.guard';
import { AdminService } from '../services/admin.service';

class UpdateSystemRoleDto {
  @ApiPropertyOptional({ enum: SystemRole })
  @IsOptional()
  @IsEnum(SystemRole)
  systemRole?: SystemRole;
}

@ApiTags('admin')
@ApiBearerAuth()
@ApiCookieAuth('access_token')
@UseGuards(SystemAdminGuard)
@RequireSystemAdmin()
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users (system admin)' })
  listUsers() {
    return this.admin.listUsers();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Platform stats (system admin)' })
  stats() {
    return this.admin.stats();
  }

  @Patch('users/:userId')
  @ApiOperation({ summary: 'Update user system role' })
  updateUser(
    @CurrentUser() actor: AuthUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateSystemRoleDto,
  ) {
    return this.admin.updateSystemRole(actor.id, userId, dto.systemRole);
  }
}
