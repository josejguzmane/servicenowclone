import { Injectable, UnauthorizedException } from '@nestjs/common';
import { permissionsForRoles, type Actor, type RoleKey } from '@servicedesk/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Builds the request principal from the database on every request so role or
   * group changes take effect without waiting for the access token to expire.
   */
  async load(userId: string): Promise<Actor> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        groupMemberships: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is not active');
    }

    const roles = user.roles.map((assignment) => assignment.role.key as RoleKey);

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      kind: user.kind,
      customerAccountId: user.customerAccountId,
      isAccountAdmin: user.isAccountAdmin,
      roles,
      permissions: permissionsForRoles(roles),
      groupIds: user.groupMemberships.map((membership) => membership.groupId),
      leadGroupIds: user.groupMemberships
        .filter((membership) => membership.isLead)
        .map((membership) => membership.groupId),
    };
  }
}
