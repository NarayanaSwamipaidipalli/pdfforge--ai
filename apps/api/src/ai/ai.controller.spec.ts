import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { TOKEN_AUDIENCE, TOKEN_ISSUER } from '../auth/token-policy';

describe('AI HTTP authentication boundary', () => {
  let app: INestApplication;
  let base: string;
  let token: string;
  const owner = 'synthetic-controller-owner';
  const secret = 'synthetic-controller-jwt-credential-long-enough';
  const service = {
    getAvailableModels: jest.fn(), summarizeDocument: jest.fn(), askDocument: jest.fn(),
    extractInvoice: jest.fn(), analyzeContract: jest.fn(), translateDocument: jest.fn(),
  };
  const routes = [
    ['summarize', 'summarizeDocument'], ['chat', 'askDocument'],
    ['extract/invoice', 'extractInvoice'], ['analyze/contract', 'analyzeContract'],
    ['translate', 'translateDocument'],
  ];

  beforeAll(async () => {
    const jwt = new JwtService();
    token = jwt.sign({ sub: owner, purpose: 'access' }, {
      secret, algorithm: 'HS256', issuer: TOKEN_ISSUER, audience: TOKEN_AUDIENCE, expiresIn: 300,
    });
    const module = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        { provide: AiService, useValue: service },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { getOrThrow: () => secret } },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    // A new ephemeral loopback listener; no development services or databases.
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(service).forEach(mock => mock.mockResolvedValue({ status: 'ok' }));
  });

  afterAll(async () => { await app?.close(); });

  it('rejects missing credentials on every document endpoint before reaching the service', async () => {
    for (const [route] of routes) {
      const response = await fetch(`${base}/api/v1/ai/${route}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fileId: 'fixture-id' }),
      });
      expect(response.status).toBe(401);
      await response.arrayBuffer();
    }
    Object.values(service).forEach(mock => expect(mock).not.toHaveBeenCalled());
  });

  it('forwards the authenticated subject to every document operation', async () => {
    const dto = { fileId: 'fixture-id', question: 'What?', targetLanguage: 'French' };
    for (const [route, method] of routes) {
      const response = await fetch(`${base}/api/v1/ai/${route}`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(dto),
      });
      expect(response.status).toBe(201);
      await response.arrayBuffer();
      if (method === 'extractInvoice' || method === 'analyzeContract') {
        expect(service[method]).toHaveBeenCalledWith('fixture-id', undefined, undefined, owner);
      } else {
        expect(service[method]).toHaveBeenCalledWith(dto, owner);
      }
    }
  });
});
