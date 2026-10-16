import { Module } from '@nestjs/common';
import { PdfJobsService } from './pdf-jobs.service';
import { PdfJobsController } from './pdf-jobs.controller';
import { PrismaService } from '../prisma/prisma.service';
import { FilesModule } from '../files/files.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [FilesModule, JwtModule],
  controllers: [PdfJobsController],
  providers: [PdfJobsService, PrismaService],
  exports: [PdfJobsService],
})
export class PdfJobsModule {}
