import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Response } from 'express';
import axios from 'axios';

@ApiTags('System & Health')
@Controller(['health', 'api/v1/health'])
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Comprehensive system health check for all cloud dependencies' })
  async checkHealth(@Res() res: Response) {
    const checks: Record<string, any> = {
      database: 'UNKNOWN',
      worker: 'UNKNOWN',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };

    let isHealthy = true;

    // 1. Check PostgreSQL Database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'UP';
    } catch (dbErr: any) {
      checks.database = `DOWN: ${dbErr.message}`;
      isHealthy = false;
    }

    // 2. Check Python PDF Processing Worker
    const workerUrl = this.configService.get<string>('PDF_WORKER_URL', 'http://localhost:8000');
    try {
      const workerRes = await axios.get(`${workerUrl}/health`, { timeout: 2000 });
      checks.worker = workerRes.status === 200 ? 'UP' : `STATUS_${workerRes.status}`;
    } catch {
      checks.worker = 'DOWN (Worker Standby)';
    }

    const statusCode = isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(statusCode).json({
      status: isHealthy ? 'healthy' : 'degraded',
      services: checks,
    });
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe for container orchestration' })
  checkLive() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe verifying database and critical services' })
  async checkReady(@Res() res: Response) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return res.status(HttpStatus.OK).json({ status: 'ready' });
    } catch (err: any) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ status: 'not_ready', error: err.message });
    }
  }
}
