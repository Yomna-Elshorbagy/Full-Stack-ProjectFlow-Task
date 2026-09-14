import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { isElevatedOrganizationRole, type OrganizationRole, type OrganizationSummary } from '@projectflow/shared';
import { OrganizationMembersService } from '../organization-members/organization-members.service';
import { UsersService } from '../users/users.service';
import { Organization, type OrganizationDocument } from './schemas/organization.schema';

export type OrganizationWithRole = OrganizationSummary & { role: OrganizationRole };

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<OrganizationDocument>,
    private readonly organizationMembersService: OrganizationMembersService,
    private readonly usersService: UsersService,
  ) {}

  async findById(organizationId: Types.ObjectId): Promise<OrganizationDocument> {
    const organization = await this.organizationModel.findById(organizationId).exec();
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return organization;
  }

  /** Organizations the user belongs to, along with the role they hold in each. */
  async findForUser(userId: Types.ObjectId): Promise<OrganizationWithRole[]> {
    const memberships = await this.organizationMembersService.findByUser(userId);
    if (memberships.length === 0) {
      return [];
    }

    const organizations = await this.organizationModel
      .find({ _id: { $in: memberships.map((membership) => membership.organizationId) } })
      .exec();

    const rolesByOrganizationId = new Map(
      memberships.map((membership) => [membership.organizationId.toString(), membership.role]),
    );

    return organizations.flatMap((organization) => {
      const role = rolesByOrganizationId.get(organization._id.toString());
      if (!role) {
        return [];
      }
      return [
        {
          id: organization._id.toString(),
          name: organization.name,
          slug: organization.slug,
          role,
        },
      ];
    });
  }

  async addMember(
    organizationId: Types.ObjectId,
    actingUserId: Types.ObjectId,
    targetEmail: string,
    role: OrganizationRole,
  ) {
    // 1. Check if the acting user is an admin or owner of this organization
    const actingRole = await this.organizationMembersService.findRole(organizationId, actingUserId);
    if (!isElevatedOrganizationRole(actingRole)) {
      throw new ForbiddenException('You do not have permission to add members to this organization');
    }

    // 2. Find the user by email
    const targetUser = await this.usersService.findByEmail(targetEmail);
    if (!targetUser) {
      throw new NotFoundException('User with this email not found');
    }

    // 3. Check if the user is already a member
    const existingRole = await this.organizationMembersService.findRole(organizationId, targetUser._id);
    if (existingRole) {
      throw new ConflictException('User is already a member of this organization');
    }

    // 4. Add the user
    await this.organizationMembersService.addMember(organizationId, targetUser._id, role);
    return { success: true };
  }
}
