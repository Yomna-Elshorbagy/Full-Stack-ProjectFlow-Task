import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { toObjectId } from '../common/utils/object-id';
import { OrganizationsService, type OrganizationWithRole } from './organizations.service';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  findMine(@CurrentUser('id') userId: string): Promise<OrganizationWithRole[]> {
    return this.organizationsService.findForUser(toObjectId(userId, 'user id'));
  }
}
