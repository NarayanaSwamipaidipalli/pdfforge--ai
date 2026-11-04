import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { tokenVerificationOptions, validTokenClaims } from '../../auth/token-policy';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Authentication token missing');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, tokenVerificationOptions(this.configService, 'access'));
      if (!validTokenClaims(payload, 'access')) throw new UnauthorizedException();
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: {
        id: true, email: true, globalRole: true, isBanned: true, twoFactorEnabled: true, tokenVersion: true,
      } });
      if (!user || user.isBanned || user.twoFactorEnabled || (user.tokenVersion ?? 0) !== (payload.tokenVersion ?? 0)) {
        throw new UnauthorizedException();
      }
      // Authorization always uses the current database role, never a stale JWT role.
      request['user'] = { ...payload, sub: user.id, email: user.email, role: user.globalRole };
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const match = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization || '');
    return match?.[1];
  }
}
