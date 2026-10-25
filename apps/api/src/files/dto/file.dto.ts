import { IsString, IsNotEmpty, IsNumber, IsOptional, Max, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PresignUploadDto {
  @ApiProperty({ example: 'quarterly_report.pdf' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ example: 4500000, description: 'File size in bytes (up to 500 MB)' })
  @IsNumber()
  @Max(524288000) // 500 MB max limit
  fileSizeBytes: number;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({ example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' })
  @IsString()
  @IsNotEmpty()
  checksumSha256: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  orgId?: string;
}

export class ConfirmUploadDto {
  @ApiProperty({ example: 'file_0918fa22' })
  @IsString()
  @IsNotEmpty()
  fileId: string;
}

export class InitiateMultipartDto {
  @ApiProperty({ example: 'massive_archive.pdf' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ example: 450000000, description: 'File size in bytes' })
  @IsNumber()
  fileSizeBytes: number;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  checksumSha256?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  orgId?: string;
}

export class PresignPartDto {
  @ApiProperty({ example: 'file_0918fa22' })
  @IsString()
  @IsNotEmpty()
  fileId: string;

  @ApiProperty({ example: 'uploadId_s3_12345' })
  @IsString()
  @IsNotEmpty()
  uploadId: string;

  @ApiProperty({ example: 1, description: '1-based part number' })
  @IsNumber()
  partNumber: number;
}

export class MultipartPartItem {
  @ApiProperty({ example: 1 })
  @IsNumber()
  PartNumber: number;

  @ApiProperty({ example: '"d41d8cd98f00b204e9800998ecf8427e"' })
  @IsString()
  @IsNotEmpty()
  ETag: string;
}

export class CompleteMultipartDto {
  @ApiProperty({ example: 'file_0918fa22' })
  @IsString()
  @IsNotEmpty()
  fileId: string;

  @ApiProperty({ example: 'uploadId_s3_12345' })
  @IsString()
  @IsNotEmpty()
  uploadId: string;

  @ApiProperty({ type: [MultipartPartItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MultipartPartItem)
  parts: MultipartPartItem[];
}
