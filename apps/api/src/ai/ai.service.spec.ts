import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OllamaProvider } from './providers/ollama.provider';
import axios from 'axios';
import { AiProviderType } from './dto/ai.dto';

jest.mock('axios');

describe('AiService', () => {
  let service: AiService;
  let prismaService: any;
  let ollamaMock: any;
  let configMock: any;
  const workerSecret = 'synthetic-worker-auth-regression-credential';
  const owner = 'synthetic-owner';

  beforeEach(async () => {
    prismaService = {
      fileRecord: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      aiConversation: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      aiMessage: {
        create: jest.fn(),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: owner, plan: 'FREE', isBanned: false }) },
      subscription: { findMany: jest.fn().mockResolvedValue([]) },
      aiJob: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({}) },
    };
    prismaService.$transaction = jest.fn(async action => action(prismaService));

    jest.clearAllMocks();
    (axios.post as jest.Mock).mockReset().mockResolvedValue({ data: { fullText: 'SYNTHETIC_DOCUMENT_CONTENT_125_50' } });
    ollamaMock = {
      isHealthy: jest.fn().mockResolvedValue(true),
      listInstalledModels: jest.fn().mockResolvedValue([{ name: 'llama3.1:8b', size: 4000000000, details: { parameter_size: '8B' } }]),
      chatCompletion: jest.fn().mockResolvedValue({
        message: { content: 'Executive Summary\n\nSimulated local answer' },
        eval_count: 150,
      }),
      generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    };
    configMock = {
      get: jest.fn((key: string, fallback?: string) => ({
        WORKER_CALLBACK_SECRET: workerSecret,
        PDF_WORKER_URL: 'http://worker.invalid',
      }[key] ?? fallback ?? null)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: PrismaService, useValue: prismaService },
        { provide: OllamaProvider, useValue: ollamaMock },
        {
          provide: ConfigService,
          useValue: configMock,
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw NotFoundException if document does not exist', async () => {
    prismaService.fileRecord.findFirst.mockResolvedValue(null);

    await expect(
      service.summarizeDocument({ fileId: 'unknown_file_id' }, owner),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns the configured provider result for an owned document', async () => {
    prismaService.fileRecord.findFirst.mockResolvedValue({
      id: 'doc_1',
      originalName: 'Financial_Report.pdf',
      storedKey: 'synthetic/fixture.pdf',
    });

    const result = await service.summarizeDocument({ fileId: 'doc_1' }, owner);
    expect(result).toBeDefined();
    expect(result.fileId).toBe('doc_1');
    expect(result.summary).toContain('Executive Summary');
    expect(axios.post).toHaveBeenCalledWith(
      'http://worker.invalid/api/v1/ai/extract-text', { s3Key: 'synthetic/fixture.pdf' },
      expect.objectContaining({ headers: { 'x-pdfforge-worker-secret': workerSecret } }),
    );
    expect(ollamaMock.chatCompletion.mock.calls[0][0][1].content).toContain('SYNTHETIC_DOCUMENT_CONTENT_125_50');
  });

  it('should extract structured invoice data', async () => {
    prismaService.fileRecord.findFirst.mockResolvedValue({
      id: 'inv_1',
      originalName: 'Vendor_Invoice.pdf',
      storedKey: 'synthetic/fixture.pdf',
    });
    (axios.post as jest.Mock).mockResolvedValue({ data: { extractedData: { totalAmount: 125 } } });

    const result = await service.extractInvoice('inv_1', undefined, undefined, owner);
    expect(result).toBeDefined();
    expect(result.documentType).toBe('INVOICE');
    expect(result.extractedData.totalAmount).toBeGreaterThan(0);
  });

  it.each([
    ['summarize', '/ai/summarize'],
    ['chat', '/ai/chat'],
    ['invoice', '/ai/extract-invoice'],
    ['contract', '/ai/analyze-contract'],
  ])('authenticates the %s worker request', async (operation, endpoint) => {
    ollamaMock.isHealthy.mockResolvedValue(false);
    prismaService.fileRecord.findFirst.mockResolvedValue({
      id: 'fixture-id', originalName: 'fixture.pdf', storedKey: 'synthetic/fixture.pdf',
    });
    (axios.post as jest.Mock).mockResolvedValue({ data: {
      summary: 'A real document summary', answer: 'A real document answer', citations: [],
      extractedData: { totalAmount: 125 }, keyClauses: [], riskScore: 0,
    } });

    if (operation === 'summarize') await service.summarizeDocument({ fileId: 'fixture-id' }, owner);
    if (operation === 'chat') await service.askDocument({ fileId: 'fixture-id', question: 'What is the total?' }, owner);
    if (operation === 'invoice') await service.extractInvoice('fixture-id', undefined, undefined, owner);
    if (operation === 'contract') await service.analyzeContract('fixture-id', undefined, undefined, owner);

    expect(axios.post).toHaveBeenCalledWith(
      `http://worker.invalid/api/v1${endpoint}`,
      expect.objectContaining({ s3Key: 'synthetic/fixture.pdf' }),
      expect.objectContaining({ headers: { 'x-pdfforge-worker-secret': workerSecret } }),
    );
  });

  it('does not send an unauthenticated request when the worker secret is missing', async () => {
    ollamaMock.isHealthy.mockResolvedValue(false);
    configMock.get.mockReturnValue(undefined);
    prismaService.fileRecord.findFirst.mockResolvedValue({
      id: 'fixture-id', originalName: 'fixture.pdf', storedKey: 'synthetic/fixture.pdf',
    });
    await expect(service.summarizeDocument({ fileId: 'fixture-id' }, owner)).rejects.toThrow(ServiceUnavailableException);
    expect(axios.post).not.toHaveBeenCalled();
  });

  const operations = (subject: AiService, userId?: string) => [
    () => subject.summarizeDocument({ fileId: 'fixture-id' }, userId),
    () => subject.askDocument({ fileId: 'fixture-id', question: 'What?' }, userId),
    () => subject.extractInvoice('fixture-id', undefined, undefined, userId),
    () => subject.analyzeContract('fixture-id', undefined, undefined, userId),
    () => subject.translateDocument({ fileId: 'fixture-id', targetLanguage: 'French' }, userId),
  ];

  it('requires a user for every document operation before reading any records', async () => {
    for (const operation of operations(service)) await expect(operation()).rejects.toThrow(UnauthorizedException);
    expect(prismaService.fileRecord.findFirst).not.toHaveBeenCalled();
    expect(prismaService.aiJob.create).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('scopes every document query to the owner and rejects missing, expired, deleted or foreign files', async () => {
    prismaService.fileRecord.findFirst.mockResolvedValue(null);
    for (const operation of operations(service, owner)) await expect(operation()).rejects.toThrow(NotFoundException);
    for (const [query] of prismaService.fileRecord.findFirst.mock.calls) {
      expect(query.where).toEqual({ id: 'fixture-id', userId: owner, deletedAt: null, expiresAt: { gt: expect.any(Date) } });
    }
    expect(axios.post).not.toHaveBeenCalled();
    expect(prismaService.fileRecord.create).not.toHaveBeenCalled();
    expect(prismaService.aiJob.create).not.toHaveBeenCalled();
  });

  it('does not substitute the latest file or create a demo when fileId is absent', async () => {
    await expect(service.summarizeDocument({ fileId: '' }, owner)).rejects.toThrow(BadRequestException);
    expect(prismaService.fileRecord.findFirst).not.toHaveBeenCalled();
    expect(prismaService.fileRecord.create).not.toHaveBeenCalled();
  });

  it('rejects a foreign conversation or a conversation for another document before side effects', async () => {
    prismaService.fileRecord.findFirst.mockResolvedValue({ id: 'fixture-id', storedKey: 'fixture.pdf' });
    prismaService.aiConversation.findFirst.mockResolvedValue(null);
    await expect(service.askDocument({ fileId: 'fixture-id', question: 'What?', conversationId: 'foreign-conversation' }, owner)).rejects.toThrow(NotFoundException);
    expect(prismaService.aiConversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-conversation', userId: owner, fileId: 'fixture-id' },
    });
    expect(prismaService.aiConversation.create).not.toHaveBeenCalled();
    expect(prismaService.aiMessage.create).not.toHaveBeenCalled();
    expect(prismaService.aiJob.create).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('does not return fabricated analyses or translation links when processing is unavailable', async () => {
    ollamaMock.isHealthy.mockResolvedValue(false);
    prismaService.fileRecord.findFirst.mockResolvedValue({ id: 'fixture-id', originalName: 'fixture.pdf', storedKey: 'fixture.pdf' });
    (axios.post as jest.Mock).mockRejectedValue(new Error('synthetic unavailable backend'));
    for (const operation of operations(service, owner)) await expect(operation()).rejects.toThrow(ServiceUnavailableException);
  });

  it('does not send local-only documents to cloud after an explicit Ollama failure', async () => {
    const originalGet = configMock.get.getMockImplementation();
    configMock.get.mockImplementation((key: string, fallback?: string) => key === 'OPENAI_API_KEY' ? 'synthetic-api-key-for-constructor-only' : originalGet(key, fallback));
    const configured = new AiService(prismaService, configMock, ollamaMock);
    const cloud = jest.spyOn((configured as any).openai.chat.completions, 'create');
    ollamaMock.chatCompletion.mockRejectedValue(new Error('synthetic local failure'));
    prismaService.fileRecord.findFirst.mockResolvedValue({ id: 'fixture-id', originalName: 'fixture.pdf', storedKey: 'synthetic/fixture.pdf' });
    await expect(configured.summarizeDocument({ fileId: 'fixture-id', provider: AiProviderType.OLLAMA }, owner)).rejects.toThrow(ServiceUnavailableException);
    await expect(configured.askDocument({ fileId: 'fixture-id', question: 'What?', provider: AiProviderType.OLLAMA }, owner)).rejects.toThrow(ServiceUnavailableException);
    expect(cloud).not.toHaveBeenCalled();
    expect(ollamaMock.chatCompletion).toHaveBeenCalledTimes(2);
  });

  it('does not consume an AI attempt for unavailable translation', async () => {
    prismaService.fileRecord.findFirst.mockResolvedValue({ id: 'fixture-id', storedKey: 'fixture.pdf' });
    await expect(service.translateDocument({ fileId: 'fixture-id', targetLanguage: 'French' }, owner)).rejects.toThrow(ServiceUnavailableException);
    expect(prismaService.aiJob.create).not.toHaveBeenCalled();
  });
});
