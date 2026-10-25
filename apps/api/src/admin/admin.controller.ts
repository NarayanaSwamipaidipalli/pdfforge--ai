import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Paginated user management list with quotas and search' })
  async getUsers(
    @Query('limit') limit = 25,
    @Query('offset') offset = 0,
    @Query('search') search = '',
  ) {
    return this.adminService.getUsers(Number(limit), Number(offset), search);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Update global role for a specific user (USER, SUPPORT, ADMIN, SUPERADMIN)' })
  async updateUserRole(@Param('id') userId: string, @Body() body: { role: string }) {
    return this.adminService.updateUserRole(userId, body.role);
  }

  @Post('users/:id/ban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend user account and revoke access' })
  async banUser(@Param('id') userId: string, @Body() body: { reason?: string }) {
    return this.adminService.banUser(userId, body?.reason || 'Terms violation');
  }

  @Post('users/:id/unban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unban suspended user account' })
  async unbanUser(@Param('id') userId: string) {
    return this.adminService.unbanUser(userId);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List all system processing and conversion jobs' })
  async getAllJobs(
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
    @Query('status') status?: string,
    @Query('tool') tool?: string,
  ) {
    return this.adminService.getAllJobs(Number(limit), Number(offset), status, tool);
  }

  @Get('jobs/failed')
  @ApiOperation({ summary: 'List failed conversion jobs with error details for triage' })
  async getFailedJobs(@Query('limit') limit = 50) {
    return this.adminService.getFailedJobs(Number(limit));
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List all multi-gateway payment transactions (Stripe, Razorpay, PayPal)' })
  async getTransactions(@Query('limit') limit = 50) {
    return this.adminService.getTransactions(Number(limit));
  }

  @Get('coupons')
  @ApiOperation({ summary: 'List active and historical promotional coupons' })
  async getCoupons() {
    return this.adminService.getCoupons();
  }

  @Post('coupons')
  @ApiOperation({ summary: 'Create a new promotional discount coupon' })
  async createCoupon(
    @Body()
    body: {
      code: string;
      discountPercent?: number;
      discountAmount?: number;
      maxUses?: number;
    },
  ) {
    return this.adminService.createCoupon(body);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Enterprise security audit trail' })
  async getAuditLogs(@Query('limit') limit = 50) {
    return this.adminService.getAuditLogs(Number(limit));
  }
}
