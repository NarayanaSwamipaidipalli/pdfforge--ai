import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
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
  GoogleOAuthStartDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  TwoFactorVerifyDto,
  CreateApiKeyDto,
  ChangePasswordDto,
  UpdateProfileDto,
  ConnectGoogleDto,
  DeleteAccountDto,
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
      if (key && val) { try { acc[key] = decodeURIComponent(val); } catch { /* Ignore malformed cookies. */ } }
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

  private oauthCookieOptions() {
    return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const,
      path: '/api/v1/auth', maxAge: 10 * 60 * 1000 };
  }

  private async consumeOAuthState(req: Request, res: Response, state?: string, redirectUri?: string, userId?: string) {
    const cookie = this.parseCookies(req.headers.cookie)['pdfforge_oauth_state'];
    const { maxAge, ...clearOptions } = this.oauthCookieOptions();
    res.clearCookie('pdfforge_oauth_state', clearOptions);
    return this.authService.validateGoogleOAuthState(state, cookie, redirectUri, userId);
  }

  @Get('google/url')
  @ApiOperation({ summary: 'Begin state-bound Google OAuth login' })
  async getGoogleAuthUrl(
    @Res({ passthrough: true }) res: Response,
    @Query('redirect_uri') redirectUri?: string,
  ) {
    const { cookie, ...result } = await this.authService.beginGoogleOAuth(redirectUri);
    res.cookie('pdfforge_oauth_state', cookie, this.oauthCookieOptions());
    res.setHeader('Cache-Control', 'no-store');
    return result;
  }

  @Post('google/link-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getGoogleLinkUrl(
    @CurrentUser('sub') userId: string,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: GoogleOAuthStartDto,
  ) {
    const { cookie, ...result } = await this.authService.beginGoogleOAuth(dto?.redirectUri, userId);
    res.cookie('pdfforge_oauth_state', cookie, this.oauthCookieOptions());
    res.setHeader('Cache-Control', 'no-store');
    return result;
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback with state validation' })
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const frontendUrl = this.authService.getFrontendUrl();
    try {
      const flow = await this.consumeOAuthState(req, res, state);
      if (error || !code) throw new UnauthorizedException('Google authentication failed');
      const result = await this.authService.googleAuth({ code, redirectUri: flow.redirectUri, nonce: flow.nonce }, req.ip, req.headers['user-agent']);
      res.cookie('pdfforge_refresh_token', result.tokens.refreshToken, {
        httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, path: '/',
      });
      // Browser session bootstrap uses the HttpOnly cookie. Credentials never enter redirect URLs.
      return res.redirect(frontendUrl + '/auth/callback?oauth=success');
    } catch {
      return res.redirect(frontendUrl + '/login?error=google_authentication_failed');
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

    const flow = dto.code ? await this.consumeOAuthState(req, res, dto.state, dto.redirectUri) : null;
    const result = await this.authService.googleAuth(
      {
        idToken: dto.idToken || dto.credential,
        code: dto.code,
        accessToken: dto.accessToken,
        redirectUri: dto.redirectUri,
        nonce: flow?.nonce,
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
    return this.authService.githubAuth(dto.code);
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
    const refreshToken = dto?.refreshToken || cookies['pdfforge_refresh_token'];
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

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('profile')
  @ApiOperation({ summary: 'Update profile details (name, avatarUrl)' })
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('google/connect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link Google account to existing user' })
  async connectGoogle(
    @CurrentUser('sub') userId: string,
    @Body() dto: ConnectGoogleDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const flow = dto.code ? await this.consumeOAuthState(req, res, dto.state, dto.redirectUri, userId) : null;
    return this.authService.connectGoogle(userId, dto, flow?.nonce);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('google/disconnect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disconnect Google account from user' })
  async disconnectGoogle(@CurrentUser('sub') userId: string) {
    return this.authService.disconnectGoogle(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete current user account' })
  async deleteAccount(
    @CurrentUser('sub') userId: string,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.deleteAccount(userId, dto);
    res.clearCookie('pdfforge_refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return result;
  }
}
