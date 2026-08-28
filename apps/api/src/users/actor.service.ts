import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { permissionsForRoles, type Actor, type RoleKey } from '@servicedesk/shared';
import { USER_REPOSITORY, type UserRepository } from '../storage/repositories';

@Injectable()
export class ActorService {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  /**
   * Builds the request principal from storage on every request so role or group
   * changes take effect without waiting for the access token to expire.
   */
  async load(userId: string): Promise<Actor> {
    const record = await this.users.findWithAccess(userId);

    if (!record || !record.user.isActive) {
      throw new UnauthorizedException('User is not active');
    }

    const { user, roles, memberships } = record;
    const roleKeys = roles.map((role) => role.key as RoleKey);

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      kind: user.kind,
      customerAccountId: user.customerAccountId,
      isAccountAdmin: user.isAccountAdmin,
      roles: roleKeys,
      permissions: permissionsForRoles(roleKeys),
      groupIds: memberships.map((membership) => membership.groupId),
      leadGroupIds: memberships
        .filter((membership) => membership.isLead)
        .map((membership) => membership.groupId),
    };
  }
}
