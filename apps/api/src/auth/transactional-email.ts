import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createHash } from 'crypto';

@Injectable()
export class TransactionalEmail {
  constructor(private readonly config: ConfigService) {}

  assertConfigured() {
    const from = this.config.get<string>('MAIL_FROM');
    const key = this.config.get<string>('RESEND_API_KEY');
    if (this.config.get('MAIL_PROVIDER') !== 'resend' || !key || key.length < 16 || !from ||
      /[\r\n]/.test(from) || !/^[^\r\n<>]*<?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/.test(from)) {
      throw new ServiceUnavailableException('Password recovery is unavailable until verified email delivery is configured');
    }
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    this.assertConfigured();
    try {
      const base = new URL(this.config.getOrThrow<string>('FRONTEND_URL'));
      if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password ||
          (base.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) throw new Error();
      const url = new URL('/reset-password', base);
      url.searchParams.set('token', token);
      const link = url.toString();
      const result = await axios.post('https://api.resend.com/emails', {
        from: this.config.get('MAIL_FROM'), to: [email], subject: 'Reset your Doxera password',
        text: `A password reset was requested for your Doxera account.\n\n${link}\n\nThis link expires in 15 minutes and works once. If you did not request it, ignore this email.`,
        html: `<h1>Reset your Doxera password</h1><p>A password reset was requested for your account.</p><p><a href="${link.replace(/&/g, '&amp;')}">Reset password</a></p><p>This link expires in 15 minutes and works once. If you did not request it, ignore this email.</p>`,
      }, { timeout: 8000, maxRedirects: 0, headers: {
        Authorization: `Bearer ${this.config.get('RESEND_API_KEY')}`,
        'Idempotency-Key': `password-reset/${createHash('sha256').update(token).digest('hex')}`,
      } });
      if (typeof result.data?.id !== 'string' || !result.data.id) throw new Error();
    } catch { throw new ServiceUnavailableException('Password recovery delivery is temporarily unavailable'); }
  }
}
