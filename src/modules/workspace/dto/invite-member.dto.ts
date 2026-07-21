import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';

export class InviteMemberDto {
  @ApiProperty({ example: 'teammate@flowpilot.dev' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({
    enum: ['GUEST', 'MEMBER', 'PROJECT_MANAGER', 'ADMIN'],
    default: 'MEMBER',
  })
  @IsOptional()
  @IsEnum(WorkspaceRole)
  role?: WorkspaceRole = WorkspaceRole.MEMBER;
}
