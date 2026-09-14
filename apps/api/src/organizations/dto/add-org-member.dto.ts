import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum } from 'class-validator';
import { OrganizationRole } from '@projectflow/shared';

export class AddOrgMemberDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: OrganizationRole, example: OrganizationRole.MEMBER })
  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}
