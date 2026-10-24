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

export class GithubAuthDto {
  @ApiProperty({ description: 'GitHub OAuth authorization code or access token' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@pdfforge.ai' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token received via email/sms' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'NewSecurePassword123!' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class VerifyEmailDto {
  @ApiProperty({ description: 'Email verification token' })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class TwoFactorVerifyDto {
  @ApiProperty({ example: '123456', description: '6-digit TOTP authentication code' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class CreateApiKeyDto {
  @ApiProperty({ example: 'CI/CD Automated Worker' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: ['pdf:process', 'ai:query'], required: false })
  @IsOptional()
  permissions?: string[];
}
