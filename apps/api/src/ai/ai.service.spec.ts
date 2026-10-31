import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { OllamaProvider } from './providers/ollama.provider';

describe('AiService', () => {
  let service: AiService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      fileRecord: {
        findUnique: jest.fn(),
      },
      aiConversation: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      aiMessage: {
        create: jest.fn(),
      },
    };

    const ollamaMock = {
      isHealthy: jest.fn().mockResolvedValue(true),
      listInstalledModels: jest.fn().mockResolvedValue([{ name: 'llama3.1:8b', size: 4000000000, details: { parameter_size: '8B' } }]),
      chatCompletion: jest.fn().mockResolvedValue({
        message: { content: 'Executive Summary\n\nSimulated local answer' },
        eval_count: 150,
      }),
      generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: PrismaService, useValue: prismaService },
        { provide: OllamaProvider, useValue: ollamaMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(null),
          },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw NotFoundException if document does not exist', async () => {
    prismaService.fileRecord.findUnique.mockResolvedValue(null);

    await expect(
      service.summarizeDocument({ fileId: 'unknown_file_id' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should return simulated structured summary when OpenAI API is in dev mode', async () => {
    prismaService.fileRecord.findUnique.mockResolvedValue({
      id: 'doc_1',
      originalName: 'Financial_Report.pdf',
    });

    const result = await service.summarizeDocument({ fileId: 'doc_1' });
    expect(result).toBeDefined();
    expect(result.fileId).toBe('doc_1');
    expect(result.summary).toContain('Executive Summary');
  });

  it('should extract structured invoice data', async () => {
    prismaService.fileRecord.findUnique.mockResolvedValue({
      id: 'inv_1',
      originalName: 'Vendor_Invoice.pdf',
    });

    const result = await service.extractInvoice('inv_1');
    expect(result).toBeDefined();
    expect(result.documentType).toBe('INVOICE');
    expect(result.extractedData.totalAmount).toBeGreaterThan(0);
  });
});
