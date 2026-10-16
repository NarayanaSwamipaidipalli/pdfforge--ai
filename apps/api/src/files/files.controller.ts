import { Controller, Post, Body, Get, Param, Delete, UseGuards, Optional } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FilesService } from './files.service';
import { PresignUploadDto, ConfirmUploadDto } from './dto/file.dto';
import { CurrentUser } from '../common/decorators/roles.decorator';

@ApiTags('Files & Storage')
@Controller('api/v1/files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('presign-upload')
  @ApiOperation({ summary: 'Obtain S3 pre-signed upload URL for direct streaming' })
  async presignUpload(
    @Body() dto: PresignUploadDto,
    @CurrentUser('sub') userId?: string,
  ) {
    return this.filesService.generatePresignedUpload(dto, userId);
  }

  @Post('confirm-upload')
  @ApiOperation({ summary: 'Confirm S3 upload completed and trigger security verification' })
  async confirmUpload(@Body() dto: ConfirmUploadDto) {
    return this.filesService.confirmUpload(dto.fileId);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Generate time-limited pre-signed download URL' })
  async getDownloadUrl(@Param('id') id: string) {
    return this.filesService.generatePresignedDownload(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Explicitly purge file from cloud storage' })
  async deleteFile(@Param('id') id: string) {
    await this.filesService.deleteFile(id);
    return { success: true, message: 'File queued for cryptographic purge' };
  }
}
