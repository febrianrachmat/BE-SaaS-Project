import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'alex@flowpilot.dev' })
  @IsEmail()
  email!: string;
}
