import { Controller, Post, Body, Get, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto, InviteMemberDto } from './dto/organization.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/roles.decorator';

@ApiTags('Organizations & Workspaces')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('api/v1/organizations')
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new team workspace organization' })
  async createOrg(@CurrentUser('sub') userId: string, @Body() dto: CreateOrganizationDto) {
    return this.orgsService.createOrganization(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all organizations the user is a member of' })
  async getMyOrgs(@CurrentUser('sub') userId: string) {
    return this.orgsService.getUserOrganizations(userId);
  }

  @Post(':id/invite')
  @ApiOperation({ summary: 'Invite a team member to an organization' })
  async invite(
    @Param('id') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.orgsService.inviteMember(orgId, userId, dto);
  }

  @Delete(':id/members/:memberUserId')
  @ApiOperation({ summary: 'Remove a team member from an organization' })
  async removeMember(
    @Param('id') orgId: string,
    @Param('memberUserId') targetUserId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.orgsService.removeMember(orgId, userId, targetUserId);
  }
}
