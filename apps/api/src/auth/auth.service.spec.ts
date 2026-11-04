import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: any;
  let jwtService: any;

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      organization: {
        create: jest.fn().mockResolvedValue({ id: 'org_1', slug: 'workspace' }),
        upsert: jest.fn().mockResolvedValue({ id: 'org_admin' }),
      },
      organizationMember: {
        create: jest.fn().mockResolvedValue({ id: 'member_1' }),
        upsert: jest.fn().mockResolvedValue({ id: 'member_admin' }),
      },
      userSession: {
        create: jest.fn().mockResolvedValue({ id: 'sess_1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock_token'),
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'user_1', role: 'USER' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: string) => {
              if (key === 'GOOGLE_CLIENT_ID') return 'mock-google-client-id';
              if (key === 'JWT_SECRET') return 'test_jwt_secret';
              if (key === 'JWT_REFRESH_SECRET') return 'test_refresh_secret';
              return defaultVal || 'mock_value';
            }),
            getOrThrow: jest.fn().mockReturnValue('mock_value'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Local Email/Password Authentication', () => {
    it('should throw ConflictException if user email already exists', async () => {
      prismaService.user.findUnique.mockResolvedValue({ id: 'existing_id', email: 'test@pdfforge.ai' });

      await expect(
        service.register({ email: 'test@pdfforge.ai', password: 'Password123!' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw UnauthorizedException on invalid login credentials', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@pdfforge.ai', password: 'WrongPassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Google OAuth 2.0 Authentication', () => {
    const mockVerifiedGooglePayload = {
      googleId: 'google_123456789',
      email: 'alex.chen@gmail.com',
      emailVerified: true,
      name: 'Alex Chen',
      picture: 'https://lh3.googleusercontent.com/avatar123',
    };

    it('should register a new user on first Google login', async () => {
      jest.spyOn(service, 'verifyGoogleToken').mockResolvedValue(mockVerifiedGooglePayload);
      prismaService.user.findUnique.mockResolvedValue(null); // No existing googleId, no existing email
      prismaService.user.create.mockResolvedValue({
        id: 'new_google_user_id',
        email: mockVerifiedGooglePayload.email,
        name: mockVerifiedGooglePayload.name,
        googleId: mockVerifiedGooglePayload.googleId,
        provider: 'GOOGLE',
        isEmailVerified: true,
        globalRole: 'USER',
        plan: 'FREE',
      });

      const res = await service.googleAuth({ idToken: 'valid_google_token' });
      expect(res.user.email).toBe('alex.chen@gmail.com');
      expect(res.user.provider).toBe('GOOGLE');
      expect(prismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'alex.chen@gmail.com',
            googleId: 'google_123456789',
            isEmailVerified: true,
          }),
        }),
      );
    });

    it('should authenticate a returning Google user', async () => {
      jest.spyOn(service, 'verifyGoogleToken').mockResolvedValue(mockVerifiedGooglePayload);
      const existingUser = {
        id: 'returning_google_user_id',
        email: mockVerifiedGooglePayload.email,
        name: mockVerifiedGooglePayload.name,
        googleId: mockVerifiedGooglePayload.googleId,
        provider: 'GOOGLE',
        isEmailVerified: true,
        globalRole: 'USER',
        plan: 'PRO',
      };
      prismaService.user.findUnique.mockResolvedValueOnce(existingUser);
      prismaService.user.update.mockResolvedValue(existingUser);

      const res = await service.googleAuth({ idToken: 'valid_google_token' });
      expect(res.user.id).toBe('returning_google_user_id');
      expect(res.user.plan).toBe('PRO');
      expect(prismaService.user.create).not.toHaveBeenCalled();
    });

    it('requires authenticated linking when the email already has an account', async () => {
      jest.spyOn(service, 'verifyGoogleToken').mockResolvedValue(mockVerifiedGooglePayload);
      prismaService.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'local_user_1' });
      await expect(service.googleAuth({ idToken: 'verified_by_boundary' })).rejects.toThrow(UnauthorizedException);
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('should reject Google login if email is unverified', async () => {
      jest.spyOn(service, 'verifyGoogleToken').mockResolvedValue({
        ...mockVerifiedGooglePayload,
        emailVerified: false,
      });

      await expect(
        service.googleAuth({ idToken: 'unverified_email_token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException if neither idToken nor code is provided', async () => {
      await expect(
        service.googleAuth({}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Token Refresh Rotation', () => {
    it('should rotate refresh token and issue new session tokens', async () => {
      const plainRefreshToken = 'valid_refresh_token_string';
      const preHashed = require('crypto').createHash('sha256').update(plainRefreshToken).digest('hex');
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(preHashed, salt);

      jwtService.verifyAsync.mockResolvedValue({ sub: 'user_active_id', purpose: 'refresh', jti: 'unique', exp: Date.now() / 1000 + 1000 });
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user_active_id',
        email: 'active@pdfforge.ai',
        globalRole: 'USER',
        refreshTokenHash: hash,
      });

      const tokens = await service.refreshTokens(plainRefreshToken);
      expect(tokens.accessToken).toBe('mock_token');
      expect(tokens.refreshToken).toBe('mock_token');
      expect(prismaService.user.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'user_active_id' }),
          data: expect.objectContaining({
            refreshTokenHash: expect.any(String),
          }),
        }),
      );
    });
  });
});
