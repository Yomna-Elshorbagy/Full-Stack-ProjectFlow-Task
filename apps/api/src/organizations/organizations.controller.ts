import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { toObjectId } from '../common/utils/object-id';
import { OrganizationsService, type OrganizationWithRole } from './organizations.service';
import { AddOrgMemberDto } from './dto/add-org-member.dto';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user organizations' })
  @ApiResponse({ status: 200, description: 'List of organizations the user belongs to.' })
  findMine(@CurrentUser('id') userId: string): Promise<OrganizationWithRole[]> {
    return this.organizationsService.findForUser(toObjectId(userId, 'user id'));
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add a member to an organization' })
  @ApiResponse({ status: 201, description: 'Member added successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Only admins can add members.' })
  @ApiResponse({ status: 404, description: 'Organization or user not found.' })
  addMember(
    @Param('id') organizationId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AddOrgMemberDto,
  ) {
    return this.organizationsService.addMember(
      toObjectId(organizationId, 'organization id'),
      toObjectId(userId, 'user id'),
      dto.email,
      dto.role,
    );
  }
}
