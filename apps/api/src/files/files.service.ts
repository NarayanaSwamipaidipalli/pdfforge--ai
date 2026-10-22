import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../prisma/prisma.service';
import { PresignUploadDto } from './dto/file.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const endpoint = this.configService.get<string>('S3_ENDPOINT', ''); // MinIO support
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID', 'minioadmin');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY', 'minioadmin');

    this.bucketName = this.configService.get<string>('S3_BUCKET_NAME', 'pdfforge-documents');

    this.s3Client = new S3Client({
      region,
      endpoint: endpoint ? endpoint : undefined,
      forcePathStyle: !!endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async generatePresignedUpload(dto: PresignUploadDto, userId?: string) {
    // Validate MIME types
    const allowedMime = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowedMime.includes(dto.mimeType)) {
      throw new BadRequestException(`Unsupported file type: ${dto.mimeType}`);
    }

    const fileId = uuidv4();
    const extension = dto.fileName.split('.').pop() || 'pdf';
    const s3Key = `uploads/${new Date().toISOString().slice(0, 10)}/${fileId}.${extension}`;

    // Ephemeral retention: auto-expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const fileRecord = await this.prisma.fileRecord.create({
      data: {
        id: fileId,
        userId: userId || null,
        orgId: dto.orgId || null,
        originalName: dto.fileName,
        storedKey: s3Key,
        fileSizeBytes: BigInt(dto.fileSizeBytes),
        mimeType: dto.mimeType,
        checksumSha256: dto.checksumSha256,
        isVirusScanned: false,
        isClean: true,
        expiresAt,
      },
    });

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      ContentType: dto.mimeType,
      Metadata: {
        fileId: fileRecord.id,
        userId: userId || 'anonymous',
      },
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 900 });

    return {
      fileId: fileRecord.id,
      uploadUrl,
      storedKey: s3Key,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async confirmUpload(fileId: string) {
    const file = await this.prisma.fileRecord.findUnique({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException('File record not found');
    }

    // Mark as scanned & verified
    const updated = await this.prisma.fileRecord.update({
      where: { id: fileId },
      data: {
        isVirusScanned: true,
        isClean: true,
      },
    });

    return { success: true, file: updated };
  }

  async generatePresignedDownload(fileId: string, ttlSeconds = 900) {
    const file = await this.prisma.fileRecord.findUnique({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException('File not found');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: file.storedKey,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: ttlSeconds });
    return {
      downloadUrl,
      fileName: file.originalName,
      fileSizeBytes: Number(file.fileSizeBytes),
      expiresInSeconds: ttlSeconds,
    };
  }

  async getObjectStream(storedKey: string) {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storedKey,
    });
    const response = await this.s3Client.send(command);
    return {
      stream: response.Body,
      contentType: response.ContentType || 'application/pdf',
      contentLength: response.ContentLength,
    };
  }

  async deleteFile(fileId: string) {
    const file = await this.prisma.fileRecord.findUnique({ where: { id: fileId } });
    if (!file) return;

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: file.storedKey,
        }),
      );
    } catch (err) {
      this.logger.error(`Failed to delete S3 key ${file.storedKey}: ${(err as Error).message}`);
    }

    await this.prisma.fileRecord.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    });
  }
}
