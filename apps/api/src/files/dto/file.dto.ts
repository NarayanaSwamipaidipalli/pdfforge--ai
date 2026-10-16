import { IsString, IsNotEmpty, IsNumber, IsOptional, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PresignUploadDto {
  @ApiProperty({ example: 'quarterly_report.pdf' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ example: 4500000, description: 'File size in bytes' })
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
