import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { ExpiredFileCleanupService } from './expired-file-cleanup.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [FilesController],
  providers: [FilesService, ExpiredFileCleanupService, PrismaService],
  exports: [FilesService],
})
export class FilesModule {}
