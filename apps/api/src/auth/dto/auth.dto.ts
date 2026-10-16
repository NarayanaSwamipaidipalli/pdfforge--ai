import { IsEmail, IsNotEmpty, IsOptional, MinLength, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@pdfforge.ai' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'P@ssword123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Sarah Connor', required: false })
  @IsString()
  @IsOptional()
  name?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@pdfforge.ai' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'P@ssword123!' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Secure refresh token' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class GoogleAuthDto {
  @ApiProperty({ description: 'Google OAuth id_token or authorization code' })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
