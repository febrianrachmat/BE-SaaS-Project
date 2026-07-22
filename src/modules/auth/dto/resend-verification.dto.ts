import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ResendVerificationDto {
  @ApiProperty({ example: 'alex@flowpilot.dev' })
  @IsEmail()
  email!: string;
}
