import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import {
  AiSummarizeDto,
  AiChatDto,
  AiExtractInvoiceDto,
  AiAnalyzeContractDto,
  AiTranslateDocumentDto,
} from './dto/ai.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/roles.decorator';

@ApiTags('AI Document Intelligence')
@Controller('api/v1/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('models')
  @ApiOperation({ summary: 'List available Cloud vs On-Premise Air-Gapped private AI models' })
  async getModels() {
    return this.aiService.getAvailableModels();
  }

  @Post('summarize')
  @ApiOperation({ summary: 'Generate structured executive summary and key insights' })
  async summarize(
    @Body() dto: AiSummarizeDto,
    @CurrentUser('sub') userId?: string,
  ) {
    return this.aiService.summarizeDocument(dto, userId);
  }

  @Post('chat')
  @ApiOperation({ summary: 'Conversational RAG Q&A over PDF with exact page citations' })
  async chat(
    @Body() dto: AiChatDto,
    @CurrentUser('sub') userId?: string,
  ) {
    return this.aiService.askDocument(dto, userId);
  }

  @Post('extract/invoice')
  @ApiOperation({ summary: 'Extract structured financial line-items, tax, and vendor data from invoice' })
  async extractInvoice(@Body() dto: AiExtractInvoiceDto) {
    return this.aiService.extractInvoice(dto.fileId, dto.provider, dto.model);
  }

  @Post('analyze/contract')
  @ApiOperation({ summary: 'Automated contract risk scoring, liability audit, and clause extraction' })
  async analyzeContract(@Body() dto: AiAnalyzeContractDto) {
    return this.aiService.analyzeContract(dto.fileId, dto.provider, dto.model);
  }

  @Post('translate')
  @ApiOperation({ summary: 'Translate document contents while preserving layout and typography' })
  async translate(@Body() dto: AiTranslateDocumentDto) {
    return this.aiService.translateDocument(dto);
  }
}
