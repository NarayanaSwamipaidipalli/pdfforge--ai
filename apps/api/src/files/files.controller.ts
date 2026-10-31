import { Controller, Post, Body, Get, Param, Delete, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FilesService } from './files.service';
import {
  PresignUploadDto,
  ConfirmUploadDto,
  InitiateMultipartDto,
  PresignPartDto,
  CompleteMultipartDto,
} from './dto/file.dto';
import { CurrentUser } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Files & Storage')
@Controller('api/v1/files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('presign-upload')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Obtain S3 pre-signed upload URL for direct streaming' })
  async presignUpload(
    @Body() dto: PresignUploadDto,
    @CurrentUser('sub') userId?: string,
  ) {
    return this.filesService.generatePresignedUpload(dto, userId);
  }

  @Post('confirm-upload')
  @ApiOperation({ summary: 'Confirm S3 upload completed and trigger security verification' })
  async confirmUpload(@Body() dto: ConfirmUploadDto, @CurrentUser('sub') userId: string) {
    return this.filesService.confirmUpload(dto.fileId, userId);
  }

  // S3 Multipart / Chunked Upload Endpoints for Large Files (500MB+)
  @Post('multipart/initiate')
  @ApiOperation({ summary: 'Initiate S3 multipart upload for large files (500MB+)' })
  async initiateMultipart(
    @Body() dto: InitiateMultipartDto,
    @CurrentUser('sub') userId?: string,
  ) {
    return this.filesService.initiateMultipartUpload(dto, userId);
  }

  @Post('multipart/presign-part')
  @ApiOperation({ summary: 'Obtain pre-signed upload URL for a specific multipart chunk' })
  async presignPart(@Body() dto: PresignPartDto, @CurrentUser('sub') userId: string) {
    return this.filesService.presignPartUpload(dto.fileId, dto.uploadId, dto.partNumber, userId);
  }

  @Post('multipart/complete')
  @ApiOperation({ summary: 'Complete S3 multipart chunked upload' })
  async completeMultipart(@Body() dto: CompleteMultipartDto, @CurrentUser('sub') userId: string) {
    return this.filesService.completeMultipartUpload(dto, userId);
  }

  @Post('multipart/abort')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Abort S3 multipart chunked upload' })
  async abortMultipart(@Body() body: { fileId: string; uploadId: string }, @CurrentUser('sub') userId: string) {
    return this.filesService.abortMultipartUpload(body.fileId, body.uploadId, userId);
  }

  @Post('cleanup-expired')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Purge expired ephemeral files adhering to zero-retention compliance' })
  async cleanupExpired() {
    return this.filesService.cleanupExpiredFiles();
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Generate time-limited pre-signed download URL' })
  async getDownloadUrl(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.filesService.generatePresignedDownload(id, 900, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Explicitly purge file from cloud storage' })
  async deleteFile(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    await this.filesService.deleteFile(id, userId);
    return { success: true, message: 'File queued for cryptographic purge' };
  }
}
