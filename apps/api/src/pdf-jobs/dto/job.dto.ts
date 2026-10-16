import { IsString, IsNotEmpty, IsArray, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePdfJobDto {
  @ApiProperty({
    example: 'merge',
    description: 'Operation name: merge | split | compress | watermark | rotate | encrypt | decrypt | pdf_to_word | ocr | etc.',
  })
  @IsString()
  @IsNotEmpty()
  tool: string;

  @ApiProperty({ example: ['file_01', 'file_02'], description: 'List of uploaded file IDs' })
  @IsArray()
  @IsNotEmpty()
  fileIds: string[];

  @ApiProperty({
    example: { compressionLevel: 'high', watermarkText: 'CONFIDENTIAL', rotationDegrees: 90 },
    required: false,
  })
  @IsObject()
  @IsOptional()
  parameters?: Record<string, any>;

  @ApiProperty({ required: false, description: 'Optional callback URL upon completion' })
  @IsString()
  @IsOptional()
  webhookUrl?: string;
}

export class WorkerCallbackDto {
  @IsString()
  @IsNotEmpty()
  jobId: string;

  @IsString()
  @IsNotEmpty()
  status: 'COMPLETED' | 'FAILED';

  @IsOptional()
  outputFileKey?: string;

  @IsOptional()
  outputFileSizeBytes?: number;

  @IsOptional()
  errorMessage?: string;

  @IsOptional()
  durationMs?: number;
}
