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
  @ApiProperty({ description: 'Secure refresh token', required: false })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}

export class GoogleAuthDto {
  @ApiProperty({ description: 'Google OAuth id_token or credential token', required: false })
  @IsString()
  @IsOptional()
  idToken?: string;

  @ApiProperty({ description: 'Google Identity Services credential', required: false })
  @IsString()
  @IsOptional()
  credential?: string;

  @ApiProperty({ description: 'Google OAuth 2.0 authorization code', required: false })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ description: 'OAuth state returned by Google', required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ description: 'OAuth 2.0 access token (rejected when provided)', required: false })
  @IsString()
  @IsOptional()
  accessToken?: string;

  @ApiProperty({ description: 'Redirect URI used during authorization code flow', required: false })
  @IsString()
  @IsOptional()
  redirectUri?: string;
}

export class GithubAuthDto {
  @ApiProperty({ description: 'GitHub OAuth authorization code or access token' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class GoogleOAuthStartDto {
  @ApiProperty({ description: 'One of the configured Google callback URIs', required: false })
  @IsString()
  @IsOptional()
  redirectUri?: string;
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

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPassword123!' })
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({ example: 'NewSecurePassword123!' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class RevokeSessionDto {
  @ApiProperty({ example: 'session-uuid-1234' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

export class UpdateProfileDto {
  @ApiProperty({ example: 'Alex Mercer', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'https://images.unsplash.com/...', required: false })
  @IsString()
  @IsOptional()
  avatarUrl?: string;
}

export class ConnectGoogleDto {
  @ApiProperty({ description: 'Google OAuth id_token or credential token', required: false })
  @IsString()
  @IsOptional()
  idToken?: string;

  @ApiProperty({ description: 'Google Identity Services credential', required: false })
  @IsString()
  @IsOptional()
  credential?: string;

  @ApiProperty({ description: 'Google OAuth 2.0 authorization code', required: false })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ description: 'OAuth state returned by Google', required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ description: 'Redirect URI used during authorization code flow', required: false })
  @IsString()
  @IsOptional()
  redirectUri?: string;
}

export class DeleteAccountDto {
  @ApiProperty({ example: 'P@ssword123!', required: false })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiProperty({ example: 'DELETE', required: true })
  @IsString()
  @IsNotEmpty()
  confirmation: string;
}
