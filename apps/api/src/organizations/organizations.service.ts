import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto, InviteMemberDto } from './dto/organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrganization(userId: string, dto: CreateOrganizationDto) {
    const slug = `${dto.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.random().toString(36).substring(2, 6)}`;

    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug,
        ownerId: userId,
        plan: 'BUSINESS',
      },
    });

    await this.prisma.organizationMember.create({
      data: {
        orgId: org.id,
        userId,
        role: 'OWNER',
      },
    });

    return org;
  }

  async getUserOrganizations(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, avatarUrl: true },
                },
              },
            },
          },
        },
      },
    });

    return memberships.map((m) => ({
      ...m.organization,
      myRole: m.role,
    }));
  }

  async inviteMember(orgId: string, currentUserId: string, dto: InviteMemberDto) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { orgId_userId: { orgId, userId: currentUserId } },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw new ForbiddenException('Only Organization Owners or Admins can invite new members');
    }

    // Find or create user invite placeholder
    let targetUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!targetUser) {
      targetUser = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          name: dto.email.split('@')[0],
          isEmailVerified: false,
        },
      });
    }

    const existingMember = await this.prisma.organizationMember.findUnique({
      where: { orgId_userId: { orgId, userId: targetUser.id } },
    });

    if (existingMember) {
      throw new BadRequestException('User is already a member of this organization');
    }

    return this.prisma.organizationMember.create({
      data: {
        orgId,
        userId: targetUser.id,
        role: dto.role || 'MEMBER',
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async removeMember(orgId: string, currentUserId: string, targetUserId: string) {
    const caller = await this.prisma.organizationMember.findUnique({
      where: { orgId_userId: { orgId, userId: currentUserId } },
    });

    if (!caller || !['OWNER', 'ADMIN'].includes(caller.role)) {
      throw new ForbiddenException('Insufficient permissions to remove members');
    }

    const target = await this.prisma.organizationMember.findUnique({
      where: { orgId_userId: { orgId, userId: targetUserId } },
    });

    if (!target) throw new NotFoundException('Member not found');
    if (target.role === 'OWNER') {
      throw new BadRequestException('Cannot remove the organization owner');
    }

    await this.prisma.organizationMember.delete({
      where: { id: target.id },
    });

    return { success: true, message: 'Member removed from organization' };
  }
}
