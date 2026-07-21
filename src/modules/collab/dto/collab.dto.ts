import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Looks good — @alex please review.' })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body!: string;
}

export class UpdateCommentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body!: string;
}

export class SearchQueryDto {
  @ApiProperty({ example: 'landing' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q!: string;

  @ApiPropertyOptional({ example: '20' })
  @IsOptional()
  @IsString()
  limit?: string;
}
