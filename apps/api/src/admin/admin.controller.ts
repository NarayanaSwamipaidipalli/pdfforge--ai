import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Admin & Observability')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPERADMIN')
@ApiBearerAuth()
@Controller('api/v1/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('telemetry')
  @ApiOperation({ summary: 'Real-time platform throughput, queue latency, and cluster health' })
  async getTelemetry() {
    return this.adminService.getSystemTelemetry();
  }

  @Get('users')
  @ApiOperation({ summary: 'Paginated user management list with quotas' })
  async getUsers(
    @Query('limit') limit = 25,
    @Query('offset') offset = 0,
  ) {
    return this.adminService.getUsers(Number(limit), Number(offset));
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Enterprise security audit trail' })
  async getAuditLogs(@Query('limit') limit = 50) {
    return this.adminService.getAuditLogs(Number(limit));
  }
}
