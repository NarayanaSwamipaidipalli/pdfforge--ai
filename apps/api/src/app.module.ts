import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { PdfJobsModule } from './pdf-jobs/pdf-jobs.module';
import { AiModule } from './ai/ai.module';
import { BillingModule } from './billing/billing.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';
import { validateEnvironment } from './common/environment';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.LOAD_LOCAL_ENV !== 'true' || process.env.NODE_ENV === 'production',
      envFilePath: ['.env.local', '.env'],
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),
    AuthModule,
    FilesModule,
    PdfJobsModule,
    AiModule,
    BillingModule,
    OrganizationsModule,
    AdminModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    PrismaService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
