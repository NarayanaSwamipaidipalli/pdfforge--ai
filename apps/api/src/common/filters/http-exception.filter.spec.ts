import { AllExceptionsFilter } from './http-exception.filter';
import { Logger, BadRequestException, HttpException, InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';

describe('exception confidentiality', () => {
  afterEach(() => jest.restoreAllMocks());
  it('hides internal messages, stack and sensitive query values', () => {
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host: any = { switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ path: '/api/v1/auth/callback', url: '/api/v1/auth/callback?code=private-fixture', method: 'GET' }) }) };
    new AllExceptionsFilter().catch(new Error('private-credential-fixture'), host);
    expect(JSON.stringify(response.json.mock.calls)).not.toMatch(/private-/);
    expect(JSON.stringify(logger.mock.calls)).not.toMatch(/private-/);
    expect(response.status).toHaveBeenCalledWith(500);
  });
  it('keeps useful validation responses', () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host: any = { switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ path: '/api/v1/example', method: 'POST' }) }) };
    new AllExceptionsFilter().catch(new BadRequestException('Invalid request'), host);
    expect(response.json.mock.calls[0][0].message).toBe('Invalid request');
  });
  it('returns deliberate service-unavailable messages but masks other server errors', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const run = (exception: unknown) => {
      const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const host: any = { switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ path: '/api/v1/billing/checkout', method: 'POST' }) }) };
      new AllExceptionsFilter().catch(exception, host);
      return { status: response.status.mock.calls[0][0], message: response.json.mock.calls[0][0].message };
    };
    expect(run(new ServiceUnavailableException('Payment provider is not configured')))
      .toEqual({ status: 503, message: 'Payment provider is not configured' });
    expect(run(new InternalServerErrorException('private-db-detail')).message).toBe('Internal server error occurred');
    expect(run(new HttpException('private-gateway-detail', 503))).toEqual({ status: 503, message: 'Internal server error occurred' });
  });
});
