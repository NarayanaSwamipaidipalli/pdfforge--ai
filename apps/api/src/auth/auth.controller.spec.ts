import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';

describe('OAuth HTTP response security', () => {
  let service: any;
  let controller: AuthController;
  let response: any;
  beforeEach(() => {
    service = { getFrontendUrl: () => 'https://frontend.example.invalid',
      beginGoogleOAuth: jest.fn().mockResolvedValue({ url: 'https://accounts.google.com/authorize', clientId: 'fixture', cookie: 'signed-cookie-fixture' }),
      validateGoogleOAuthState: jest.fn().mockResolvedValue({ redirectUri: 'https://api.example.invalid/api/v1/auth/google/callback', nonce: 'fixture-nonce' }),
      googleAuth: jest.fn().mockResolvedValue({ user: { id: 'fixture-user' }, tokens: { accessToken: 'access-fixture', refreshToken: 'refresh-fixture' } }),
    };
    controller = new AuthController(service);
    response = { cookie: jest.fn(), clearCookie: jest.fn(), redirect: jest.fn(), setHeader: jest.fn() };
  });
  it('keeps the signed browser state in an HttpOnly cookie and never returns it in the JSON body', async () => {
    const result = await controller.getGoogleAuthUrl(response, 'https://frontend.example.invalid/auth/callback');
    expect(result).not.toHaveProperty('cookie');
    expect(response.cookie).toHaveBeenCalledWith('pdfforge_oauth_state', 'signed-cookie-fixture', expect.objectContaining({ httpOnly: true, sameSite: 'lax' }));
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
  it('validates and clears the browser state before exchanging a code', async () => {
    const req = { headers: { cookie: 'pdfforge_oauth_state=signed-cookie-fixture' }, ip: '127.0.0.1' } as any;
    await controller.googleCallback('code-fixture', 'state-fixture', undefined, req, response);
    expect(service.validateGoogleOAuthState).toHaveBeenCalledWith('state-fixture', 'signed-cookie-fixture', undefined, undefined);
    expect(response.clearCookie).toHaveBeenCalledWith('pdfforge_oauth_state', expect.any(Object));
    expect(service.googleAuth).toHaveBeenCalledWith(expect.objectContaining({ code: 'code-fixture', nonce: 'fixture-nonce' }), '127.0.0.1', undefined);
    expect(response.redirect).toHaveBeenCalledWith('https://frontend.example.invalid/auth/callback?oauth=success');
    expect(response.redirect.mock.calls[0][0]).not.toMatch(/token|refreshToken|userId/);
    expect(response.cookie).toHaveBeenCalledWith('pdfforge_refresh_token', 'refresh-fixture', expect.objectContaining({ httpOnly: true }));
  });
  it('does not exchange a Google code on invalid or absent OAuth state', async () => {
    service.validateGoogleOAuthState.mockRejectedValue(new UnauthorizedException());
    await controller.googleCallback('code-fixture', 'wrong', undefined, { headers: {} } as any, response);
    expect(service.googleAuth).not.toHaveBeenCalled();
    expect(response.redirect).toHaveBeenCalledWith('https://frontend.example.invalid/login?error=google_authentication_failed');
    await expect(controller.googleAuth({ code: 'code-fixture' }, { headers: {} } as any, response)).rejects.toThrow(UnauthorizedException);
    expect(service.googleAuth).not.toHaveBeenCalled();
  });
});
