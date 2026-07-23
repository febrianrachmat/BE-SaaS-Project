import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateShareLinkDto {
  @ApiPropertyOptional({
    description: 'Optional expiry in days (1–365). Omit for no expiry.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}
