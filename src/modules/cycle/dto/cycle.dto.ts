import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CycleStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCycleDto {
  @ApiProperty({ example: 'Sprint 14' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: CycleStatus })
  @IsOptional()
  @IsEnum(CycleStatus)
  status?: CycleStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateCycleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ enum: CycleStatus })
  @IsOptional()
  @IsEnum(CycleStatus)
  status?: CycleStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string | null;
}

export class AddCycleTaskDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  taskId!: string;
}

export class CycleCandidatesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
