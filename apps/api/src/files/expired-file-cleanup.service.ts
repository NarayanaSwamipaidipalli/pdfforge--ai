import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { FilesService } from './files.service';

@Injectable()
export class ExpiredFileCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExpiredFileCleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly filesService: FilesService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.runCleanup().catch((error) =>
        this.logger.error(`Expired file cleanup failed: ${(error as Error).message}`),
      );
    }, 15 * 60 * 1000);
    void this.runCleanup();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async runCleanup() {
    const result = await this.filesService.cleanupExpiredFiles();
    if (result.purgedCount > 0) {
      this.logger.log(`Cleaned up ${result.purgedCount} expired files`);
    }
  }
}
