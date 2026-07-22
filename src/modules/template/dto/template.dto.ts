import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Sprint Kickoff' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: '📋' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  icon?: string;

  @ApiProperty({
    description: 'Template structure (project + tasks)',
    example: {
      project: { name: 'Launch', description: null, icon: '🚀' },
      tasks: [
        {
          title: 'Draft brief',
          status: 'TODO',
          priority: 'MEDIUM',
          description: null,
        },
      ],
    },
  })
  @IsObject()
  payload!: Record<string, unknown>;
}

export class CreateTemplateFromProjectDto {
  @ApiProperty({ example: 'getting-started' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  projectSlug!: string;

  @ApiProperty({ example: 'Getting Started Template' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  icon?: string;
}

export class ApplyTemplateDto {
  @ApiPropertyOptional({
    description: 'Override project name (defaults to template project name)',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;
}
