import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Actor, Permission } from '@servicedesk/shared';
import type { AuthenticatedRequest } from './request';

export const IS_PUBLIC_KEY = 'authz:public';
export const PERMISSIONS_KEY = 'authz:permissions';

/** Marks a route as reachable without an access token. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** Requires every listed permission (AND). Scope checks still happen per record. */
export const RequirePermissions = (
  ...permissions: Permission[]
): MethodDecorator & ClassDecorator => SetMetadata(PERMISSIONS_KEY, permissions);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Actor => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.actor) {
      throw new Error('CurrentUser used on a route without authentication');
    }
    return request.actor;
  },
);
