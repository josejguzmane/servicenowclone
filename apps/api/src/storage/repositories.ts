import type {
  AuditLog,
  CustomerAccount,
  Group,
  GroupMember,
  RefreshToken,
  Role,
  User,
} from './entities';

/**
 * Storage contracts the domain depends on. Services never touch a driver
 * directly, so moving from the JSON document store to PostgreSQL means adding
 * an implementation of these interfaces — not editing the services.
 */

export const USER_REPOSITORY = Symbol('UserRepository');
export const REFRESH_TOKEN_REPOSITORY = Symbol('RefreshTokenRepository');
export const AUDIT_REPOSITORY = Symbol('AuditRepository');
export const CUSTOMER_ACCOUNT_REPOSITORY = Symbol('CustomerAccountRepository');
export const DATA_STORE = Symbol('DataStore');

export interface UserWithAccess {
  user: User;
  roles: Role[];
  memberships: GroupMember[];
}

export interface UserSearchOptions {
  term?: string;
  kind?: User['kind'];
  limit: number;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  /** User plus the roles and group memberships needed to build a request principal. */
  findWithAccess(id: string): Promise<UserWithAccess | null>;
  search(options: UserSearchOptions): Promise<User[]>;
  create(input: {
    email: string;
    name: string;
    kind: User['kind'];
    customerAccountId: string | null;
    passwordHash: string;
    roleKeys: string[];
  }): Promise<User>;
  recordLogin(id: string, at: Date): Promise<void>;
}

export interface RefreshTokenRepository {
  create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ip?: string;
    userAgent?: string;
  }): Promise<RefreshToken>;
  findByHash(tokenHash: string): Promise<RefreshToken | null>;
  revokeById(id: string, at: Date): Promise<void>;
  revokeByHash(tokenHash: string, at: Date): Promise<void>;
  revokeAllForUser(userId: string, at: Date): Promise<void>;
}

export interface AuditQuery {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  limit: number;
  cursor?: string;
}

export type AuditRow = Omit<AuditLog, 'id' | 'occurredAt'> & {
  id?: string;
  occurredAt?: string;
};

export interface AuditListItem extends AuditLog {
  actor: { id: string; name: string; email: string } | null;
}

export interface AuditRepository {
  append(rows: AuditRow[]): Promise<void>;
  list(query: AuditQuery): Promise<{ items: AuditListItem[]; nextCursor: string | null }>;
}

export interface CustomerAccountRepository {
  findByDomain(domain: string): Promise<CustomerAccount | null>;
  create(input: { name: string; domain: string }): Promise<CustomerAccount>;
}

/** Driver-level health and lifecycle, independent of any single collection. */
export interface DataStore {
  readonly driver: string;
  isHealthy(): Promise<boolean>;
}

export type { Group };
