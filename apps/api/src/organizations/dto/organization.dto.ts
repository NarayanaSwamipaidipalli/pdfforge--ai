import { IsString, IsNotEmpty, IsEmail, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum OrgRoleDto {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme Legal Team' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class InviteMemberDto {
  @ApiProperty({ example: 'colleague@acme.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ enum: OrgRoleDto, default: OrgRoleDto.MEMBER })
  @IsEnum(OrgRoleDto)
  @IsOptional()
  role?: OrgRoleDto;
}
