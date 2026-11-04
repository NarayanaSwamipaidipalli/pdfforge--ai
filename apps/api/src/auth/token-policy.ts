import { ConfigService } from '@nestjs/config';
import { JwtVerifyOptions } from '@nestjs/jwt';

export const TOKEN_ISSUER = 'pdfforge-api';
export const TOKEN_AUDIENCE = 'pdfforge-web';

export function tokenVerificationOptions(config: ConfigService, purpose: 'access' | 'refresh' | 'oauth_state'): JwtVerifyOptions {
  return {
    secret: config.getOrThrow<string>(purpose === 'refresh' ? 'JWT_REFRESH_SECRET' : 'JWT_SECRET'),
    algorithms: ['HS256'],
    issuer: TOKEN_ISSUER,
    audience: purpose === 'oauth_state' ? 'pdfforge-oauth' : TOKEN_AUDIENCE,
  };
}

export function validTokenClaims(payload: any, purpose: 'access' | 'refresh'): boolean {
  return !!payload && payload.purpose === purpose && typeof payload.sub === 'string' && payload.sub.length > 0
    && typeof payload.exp === 'number' && Number.isFinite(payload.exp)
    && (payload.tokenVersion === undefined || (Number.isSafeInteger(payload.tokenVersion) && payload.tokenVersion >= 0))
    && (purpose !== 'refresh' || (typeof payload.jti === 'string' && payload.jti.length > 0));
}
