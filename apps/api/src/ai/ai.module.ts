import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { OllamaProvider } from './providers/ollama.provider';

@Module({
  imports: [JwtModule],
  controllers: [AiController],
  providers: [AiService, PrismaService, OllamaProvider],
  exports: [AiService, OllamaProvider],
})
export class AiModule {}
