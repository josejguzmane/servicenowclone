import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@servicedesk/shared';
import { PERMISSIONS_KEY } from '../common/decorators';
import type { AuthenticatedRequest } from '../common/request';

/**
 * Coarse route-level check. Record-level scope is still enforced by
 * PolicyService inside the services.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { actor } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!actor) throw new ForbiddenException('Not authenticated');

    const missing = required.filter((permission) => !actor.permissions.includes(permission));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
    }
    return true;
  }
}
