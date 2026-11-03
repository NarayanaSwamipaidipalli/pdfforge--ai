import { Test, TestingModule } from '@nestjs/testing';
import { PdfJobsService } from './pdf-jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import axios from 'axios';

jest.mock('axios');

describe('PdfJobsService', () => {
  let service: PdfJobsService;
  let prismaService: any;
  let filesService: any;

  beforeEach(async () => {
    prismaService = {
      fileRecord: {
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      processingJob: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    filesService = {
      generatePresignedDownload: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfJobsService,
        { provide: PrismaService, useValue: prismaService },
        { provide: FilesService, useValue: filesService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://localhost:8000'),
          },
        },
      ],
    }).compile();

    service = module.get<PdfJobsService>(PdfJobsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should reject job creation if referenced input file does not exist', async () => {
    prismaService.fileRecord.findMany.mockResolvedValue([]); // file not found

    await expect(
      service.createJob({
        tool: 'merge',
        fileIds: ['non_existent_id'],
      }, 'synthetic-owner'),
    ).rejects.toThrow(BadRequestException);
  });

  it('marks unavailable worker jobs failed without fabricating output', async () => {
    prismaService.processingJob.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    (axios.post as jest.Mock).mockRejectedValueOnce(new Error('Unavailable fixture'));
    await (service as any).dispatchToWorker('fixture-job', 'word_to_pdf', [], {});
    expect(prismaService.processingJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'FAILED' }),
    }));
    for (const [call] of prismaService.processingJob.update.mock.calls) {
      expect(call.data.status).not.toBe('COMPLETED');
      expect(call.data.outputFileKey).toBeUndefined();
    }
  });
});
