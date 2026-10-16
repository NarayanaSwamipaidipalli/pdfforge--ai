import { Test, TestingModule } from '@nestjs/testing';
import { PdfJobsService } from './pdf-jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

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
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
