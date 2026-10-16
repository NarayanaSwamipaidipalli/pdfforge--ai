import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: any;
  let jwtService: any;

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      organization: {
        create: jest.fn(),
      },
      organizationMember: {
        create: jest.fn(),
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
            get: jest.fn().mockReturnValue('mock_secret'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

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
