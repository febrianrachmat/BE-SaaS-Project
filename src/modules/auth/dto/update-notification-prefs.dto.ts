import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPrefsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  taskAssigned?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  taskUpdated?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  commentAdded?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  mention?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  invitation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dueSoon?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
