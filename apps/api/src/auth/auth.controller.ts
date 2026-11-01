import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  GoogleAuthDto,
  GithubAuthDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  TwoFactorVerifyDto,
  CreateApiKeyDto,
  ChangePasswordDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Authentication')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private parseCookies(cookieHeader?: string): Record<string, string> {
    if (!cookieHeader) return {};
    return cookieHeader.split(';').reduce((acc, c) => {
      const [key, val] = c.trim().split('=');
      if (key && val) acc[key] = decodeURIComponent(val);
      return acc;
    }, {} as Record<string, string>);
  }

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, description: 'User successfully created' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);
    res.cookie('pdfforge_refresh_token', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    return result;
  }

  @Post('login')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user with email and password' })
  @ApiResponse({ status: 200, description: 'Successfully authenticated' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'Web Browser';
    const result = await this.authService.login(dto, ip, userAgent);

    res.cookie('pdfforge_refresh_token', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return result;
  }

  @Get('google/url')
  @ApiOperation({ summary: 'Retrieve official Google OAuth 2.0 authorization URL' })
  getGoogleAuthUrl(
    @Query('state') state?: string,
    @Query('redirect_uri') redirectUri?: string,
  ) {
    return {
      url: this.authService.getGoogleAuthUrl(state, redirectUri),
      clientId: this.authService.getGoogleClientId(),
    };
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth 2.0 redirect callback' })
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const frontendUrl = this.authService.getFrontendUrl();
    if (error) {
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error)}`);
    }
    if (!code) {
      return res.redirect(`${frontendUrl}/login?error=missing_authorization_code`);
    }

    try {
      const ip = (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1';
      const userAgent = (req.headers['user-agent'] as string) || 'Web Browser';
      const result = await this.authService.googleAuth({ code }, ip, userAgent);

      res.cookie('pdfforge_refresh_token', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      return res.redirect(
        `${frontendUrl}/auth/callback?token=${result.tokens.accessToken}&refreshToken=${result.tokens.refreshToken}&userId=${result.user.id}&plan=${result.user.plan}&role=${result.user.role}`,
      );
    } catch (err: any) {
      return res.redirect(
        `${frontendUrl}/login?error=${encodeURIComponent(err.message || 'Google authentication failed')}`,
      );
    }
  }

  @Post('google')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate via Google OAuth 2.0 ID Token or Authorization Code' })
  async googleAuth(
    @Body() dto: GoogleAuthDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'Web Browser';

    const result = await this.authService.googleAuth(
      {
        idToken: dto.idToken || dto.credential,
        code: dto.code,
        redirectUri: dto.redirectUri,
      },
      ip,
      userAgent,
    );

    res.cookie('pdfforge_refresh_token', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return result;
  }

  @Post('github')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate via GitHub OAuth' })
  async githubAuth(
    @Body() dto: GithubAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.githubAuth(dto.code);
    res.cookie('pdfforge_refresh_token', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    return result;
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email token' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with verification token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify user email address' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('2fa/generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate 2FA TOTP secret key and QR code link' })
  async generate2Fa(@CurrentUser('sub') userId: string) {
    return this.authService.generate2FaSecret(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify 6-digit TOTP code and activate 2FA' })
  async verify2Fa(@CurrentUser('sub') userId: string, @Body() dto: TwoFactorVerifyDto) {
    return this.authService.verify2Fa(userId, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('api-keys')
  @ApiOperation({ summary: 'List all active API keys for authenticated user' })
  async getApiKeys(@CurrentUser('sub') userId: string) {
    return this.authService.getUserApiKeys(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('api-keys')
  @ApiOperation({ summary: 'Generate a new developer API key' })
  async createApiKey(@CurrentUser('sub') userId: string, @Body() dto: CreateApiKeyDto) {
    return this.authService.createApiKey(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('api-keys/:id')
  @ApiOperation({ summary: 'Revoke an existing developer API key' })
  async revokeApiKey(@CurrentUser('sub') userId: string, @Param('id') keyId: string) {
    return this.authService.revokeApiKey(userId, keyId);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh expired JWT access token' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = this.parseCookies(req.headers.cookie);
    const refreshToken = dto.refreshToken || cookies['pdfforge_refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokens = await this.authService.refreshTokens(refreshToken);

    res.cookie('pdfforge_refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return tokens;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke active refresh token session' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser('sub') userId?: string,
  ) {
    const cookies = this.parseCookies(req.headers.cookie);
    const refreshToken = req.body?.refreshToken || cookies['pdfforge_refresh_token'];

    if (refreshToken) {
      await this.authService.logoutByToken(refreshToken).catch(() => {});
    } else if (userId) {
      await this.authService.logout(userId).catch(() => {});
    }

    res.clearCookie('pdfforge_refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return { success: true, message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Retrieve currently logged in profile and memberships' })
  async getProfile(@CurrentUser('sub') userId: string) {
    return this.authService.getMe(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change current user password' })
  async changePassword(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto.oldPassword, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('sessions')
  @ApiOperation({ summary: 'List all active user sessions and devices' })
  async getSessions(@CurrentUser('sub') userId: string) {
    return this.authService.getSessions(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Revoke a specific active user session' })
  async revokeSession(
    @CurrentUser('sub') userId: string,
    @Param('id') sessionId: string,
  ) {
    return this.authService.revokeSession(userId, sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('sessions')
  @ApiOperation({ summary: 'Revoke all other active user sessions' })
  async revokeAllOtherSessions(@CurrentUser('sub') userId: string) {
    return this.authService.revokeAllOtherSessions(userId);
  }
}
