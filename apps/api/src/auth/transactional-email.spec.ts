import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { createHash } from 'crypto';
import { TransactionalEmail } from './transactional-email';
import { AuthService } from './auth.service';

const configuration = (overrides = {}) => {
  const values = { MAIL_PROVIDER: 'resend', RESEND_API_KEY: 'synthetic-delivery-api-credential',
    MAIL_FROM: 'Doxera <noreply@example.invalid>', FRONTEND_URL: 'https://doxera.in', ...overrides };
  return { get: key => values[key], getOrThrow: key => { if (!values[key]) throw new Error('Missing fixture'); return values[key]; } } as ConfigService;
};

describe('Doxera transactional password delivery', () => {
  let post: jest.SpyInstance;
  beforeEach(() => { post = jest.spyOn(axios, 'post').mockResolvedValue({ data: { id: 'synthetic-delivery-id' } }); });
  afterEach(() => jest.restoreAllMocks());
  it('sends only to the fixed Resend endpoint with a branded, bounded reset link', async () => {
    const token = 'a'.repeat(64);
    await new TransactionalEmail(configuration()).sendPasswordReset('fixture@example.invalid', token);
    expect(post).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      subject: 'Reset your Doxera password', to: ['fixture@example.invalid'],
      text: expect.stringContaining(`https://doxera.in/reset-password?token=${token}`),
    }), expect.objectContaining({ timeout: 8000, maxRedirects: 0 }));
    expect(post.mock.calls[0][1].text).toContain('15 minutes');
  });
  it.each([{ RESEND_API_KEY: '' }, { MAIL_FROM: 'Sender\r\nInjected: value' }, { MAIL_PROVIDER: 'unsupported' }, { FRONTEND_URL: 'http://outside.invalid' }])('fails closed for invalid delivery configuration', async changes => {
    await expect(new TransactionalEmail(configuration(changes)).sendPasswordReset('fixture@example.invalid', 'a'.repeat(64))).rejects.toThrow(ServiceUnavailableException);
    expect(post).not.toHaveBeenCalled();
  });
  it('never exposes provider error or authorization details', async () => {
    post.mockRejectedValue(new Error('SYNTHETIC_PRIVATE_PROVIDER_DETAIL'));
    await expect(new TransactionalEmail(configuration()).sendPasswordReset('fixture@example.invalid', 'a'.repeat(64))).rejects.toThrow('Password recovery delivery is temporarily unavailable');
  });
  it('stores only a digest and gives unknown accounts the same public response', async () => {
    const prisma: any = { user: { findUnique: jest.fn().mockResolvedValue({ id: 'fixture', email: 'fixture@example.invalid', passwordHash: 'synthetic-hash' }),
      update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const service = new AuthService(prisma, new JwtService(), configuration());
    const known = await service.forgotPassword('fixture@example.invalid');
    const link = /https:\/\/[^\s]+/.exec(post.mock.calls[0][1].text)![0];
    const token = new URL(link).searchParams.get('token')!;
    const stored = prisma.user.update.mock.calls[0][0].data;
    expect(stored.passwordResetToken).toBe(createHash('sha256').update(token).digest('hex'));
    expect(stored.passwordResetToken).not.toBe(token);
    expect(stored.passwordResetExpiresAt.getTime() - Date.now()).toBeLessThanOrEqual(15 * 60 * 1000);
    expect(JSON.stringify(known)).not.toContain(token);
    prisma.user.findUnique.mockResolvedValue(null);
    expect(await service.forgotPassword('unknown@example.invalid')).toEqual(known);
    expect(post).toHaveBeenCalledTimes(1);
  });
  it('invalidates only the failed delivery credential and keeps failures private', async () => {
    post.mockRejectedValue(new Error('SYNTHETIC_PRIVATE_PROVIDER_DETAIL'));
    const warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const prisma: any = { user: { findUnique: jest.fn().mockResolvedValue({ id: 'fixture', email: 'fixture@example.invalid', passwordHash: 'synthetic-hash' }),
      update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const result = await new AuthService(prisma, new JwtService(), configuration()).forgotPassword('fixture@example.invalid');
    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: 'fixture', passwordResetToken: expect.any(String) }, data: { passwordResetToken: null, passwordResetExpiresAt: null } });
    expect(JSON.stringify(result) + JSON.stringify(warning.mock.calls)).not.toContain('SYNTHETIC_PRIVATE_PROVIDER_DETAIL');
  });
});
