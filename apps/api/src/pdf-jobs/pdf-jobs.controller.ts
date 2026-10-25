import { Controller, Post, Body, Get, Param, UseGuards, Optional, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { PdfJobsService } from './pdf-jobs.service';
import { CreatePdfJobDto, WorkerCallbackDto } from './dto/job.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/roles.decorator';

@ApiTags('PDF Processing Engine')
@Controller('api/v1/pdf/jobs')
export class PdfJobsController {
  constructor(private readonly pdfJobsService: PdfJobsService) {}

  @Post()
  @ApiOperation({ summary: 'Dispatch a new PDF processing or conversion task' })
  async createJob(
    @Body() dto: CreatePdfJobDto,
    @CurrentUser('sub') userId?: string,
  ) {
    return this.pdfJobsService.createJob(dto, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Query job status, progress percentage, and output download link' })
  async getJobStatus(@Param('id') id: string) {
    return this.pdfJobsService.getJobStatus(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Stream and download processed output file for a job' })
  async downloadJobOutput(@Param('id') id: string, @Res() res: Response) {
    const { stream, fileName, contentType } = await this.pdfJobsService.getJobOutputStream(id);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    (stream as any).pipe(res);
  }

  @Post('callback')
  @ApiOperation({ summary: 'Internal worker webhook endpoint to report job completion/failure' })
  async workerCallback(@Body() dto: WorkerCallbackDto) {
    return this.pdfJobsService.handleWorkerCallback(dto);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an active or queued processing job' })
  async cancelJob(@Param('id') id: string) {
    return this.pdfJobsService.cancelJob(id);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Manually retry a failed or stalled processing job' })
  async retryJob(@Param('id') id: string) {
    return this.pdfJobsService.retryJob(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('user/history')
  @ApiOperation({ summary: 'Retrieve recent processing jobs for the authenticated user' })
  async getUserHistory(@CurrentUser('sub') userId: string) {
    return this.pdfJobsService.getUserJobs(userId);
  }
}
