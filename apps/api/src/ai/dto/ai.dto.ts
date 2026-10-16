import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum SummaryLength {
  SHORT = 'short',
  BALANCED = 'balanced',
  DETAILED = 'detailed',
}

export enum AiProviderType {
  OPENAI = 'openai',
  OLLAMA = 'ollama',
  VLLM = 'vllm',
}

export class AiSummarizeDto {
  @ApiProperty({ example: 'file_0918fa22' })
  @IsString()
  @IsNotEmpty()
  fileId: string;

  @ApiProperty({ enum: SummaryLength, default: SummaryLength.BALANCED })
  @IsEnum(SummaryLength)
  @IsOptional()
  length?: SummaryLength;

  @ApiProperty({ example: ['legal liabilities', 'financial overview'], required: false })
  @IsArray()
  @IsOptional()
  focusTopics?: string[];

  @ApiProperty({ enum: AiProviderType, default: AiProviderType.OPENAI, required: false })
  @IsEnum(AiProviderType)
  @IsOptional()
  provider?: AiProviderType;

  @ApiProperty({ example: 'llama3.1:8b', required: false })
  @IsString()
  @IsOptional()
  model?: string;
}

export class AiChatDto {
  @ApiProperty({ example: 'file_0918fa22' })
  @IsString()
  @IsNotEmpty()
  fileId: string;

  @ApiProperty({ example: 'What is the indemnity clause outlined in Section 8?' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  conversationId?: string;

  @ApiProperty({ enum: AiProviderType, default: AiProviderType.OPENAI, required: false })
  @IsEnum(AiProviderType)
  @IsOptional()
  provider?: AiProviderType;

  @ApiProperty({ example: 'llama3.1:8b', required: false })
  @IsString()
  @IsOptional()
  model?: string;
}

export class AiExtractInvoiceDto {
  @ApiProperty({ example: 'file_0918fa22' })
  @IsString()
  @IsNotEmpty()
  fileId: string;

  @ApiProperty({ enum: AiProviderType, default: AiProviderType.OPENAI, required: false })
  @IsEnum(AiProviderType)
  @IsOptional()
  provider?: AiProviderType;

  @ApiProperty({ example: 'llama3.1:8b', required: false })
  @IsString()
  @IsOptional()
  model?: string;
}

export class AiAnalyzeContractDto {
  @ApiProperty({ example: 'file_0918fa22' })
  @IsString()
  @IsNotEmpty()
  fileId: string;

  @ApiProperty({ enum: AiProviderType, default: AiProviderType.OPENAI, required: false })
  @IsEnum(AiProviderType)
  @IsOptional()
  provider?: AiProviderType;

  @ApiProperty({ example: 'llama3.1:8b', required: false })
  @IsString()
  @IsOptional()
  model?: string;
}

export class AiTranslateDocumentDto {
  @ApiProperty({ example: 'file_0918fa22' })
  @IsString()
  @IsNotEmpty()
  fileId: string;

  @ApiProperty({ example: 'Spanish', description: 'Target language name or code' })
  @IsString()
  @IsNotEmpty()
  targetLanguage: string;
}
