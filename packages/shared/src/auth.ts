import type { Permission, RoleKey } from './permissions';

export const USER_KINDS = ['internal', 'external'] as const;
export type UserKind = (typeof USER_KINDS)[number];

/** The authenticated principal, resolved once per request from the access token. */
export interface Actor {
  userId: string;
  email: string;
  name: string;
  kind: UserKind;
  /** Set for external contacts; scopes every ticket query they can make. */
  customerAccountId: string | null;
  /** External contact who may see every ticket of their customer account. */
  isAccountAdmin: boolean;
  roles: RoleKey[];
  permissions: Permission[];
  /** Assignment groups the actor belongs to; drives the `group` read scope. */
  groupIds: string[];
  /** Groups where the actor is a lead. */
  leadGroupIds: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SessionResponse extends AuthTokens {
  user: Actor;
}
