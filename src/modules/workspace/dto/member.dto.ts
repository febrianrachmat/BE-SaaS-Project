import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ['GUEST', 'MEMBER', 'PROJECT_MANAGER', 'ADMIN'] })
  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}

export class TransferOwnershipDto {
  @ApiProperty({ description: 'User ID of the new owner (must be a member)' })
  @IsUUID()
  @IsNotEmpty()
  newOwnerId!: string;
}

export class AcceptInvitationDto {
  @ApiProperty()
  @IsNotEmpty()
  token!: string;
}
