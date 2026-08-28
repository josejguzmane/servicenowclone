import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  AuditLog,
  CustomerAccount,
  RefreshToken,
  User,
} from '../entities';
import type {
  AuditListItem,
  AuditQuery,
  AuditRepository,
  AuditRow,
  CustomerAccountRepository,
  RefreshTokenRepository,
  UserRepository,
  UserSearchOptions,
  UserWithAccess,
} from '../repositories';
import { JsonDatabase } from './json-database';

@Injectable()
export class JsonUserRepository implements UserRepository {
  constructor(private readonly db: JsonDatabase) {}

  async findById(id: string): Promise<User | null> {
    return this.db.read().users.find((user) => user.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.db.read().users.find((user) => user.email === email) ?? null;
  }

  async findWithAccess(id: string): Promise<UserWithAccess | null> {
    const data = this.db.read();
    const user = data.users.find((candidate) => candidate.id === id);
    if (!user) return null;

    const roleIds = new Set(
      data.userRoles.filter((link) => link.userId === id).map((link) => link.roleId),
    );

    return {
      user,
      roles: data.roles.filter((role) => roleIds.has(role.id)),
      memberships: data.groupMembers.filter((member) => member.userId === id),
    };
  }

  async search(options: UserSearchOptions): Promise<User[]> {
    const term = options.term?.toLowerCase();
    return this.db
      .read()
      .users.filter((user) => user.isActive)
      .filter((user) => (options.kind ? user.kind === options.kind : true))
      .filter((user) =>
        term
          ? user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term)
          : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, options.limit);
  }

  async create(input: {
    email: string;
    name: string;
    kind: User['kind'];
    customerAccountId: string | null;
    passwordHash: string;
    roleKeys: string[];
  }): Promise<User> {
    const now = new Date().toISOString();
    const user: User = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
      kind: input.kind,
      customerAccountId: input.customerAccountId,
      isAccountAdmin: false,
      department: null,
      passwordHash: input.passwordHash,
      isActive: true,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };

    return this.db.mutate((data) => {
      data.users.push(user);
      for (const key of input.roleKeys) {
        const role = data.roles.find((candidate) => candidate.key === key);
        if (role) data.userRoles.push({ userId: user.id, roleId: role.id });
      }
      return user;
    });
  }

  async recordLogin(id: string, at: Date): Promise<void> {
    await this.db.mutate((data) => {
      const user = data.users.find((candidate) => candidate.id === id);
      if (user) {
        user.lastLoginAt = at.toISOString();
        user.updatedAt = at.toISOString();
      }
    });
  }
}

@Injectable()
export class JsonRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly db: JsonDatabase) {}

  async create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ip?: string;
    userAgent?: string;
  }): Promise<RefreshToken> {
    const token: RefreshToken = {
      id: randomUUID(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt.toISOString(),
      revokedAt: null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      createdAt: new Date().toISOString(),
    };
    return this.db.mutate((data) => {
      data.refreshTokens.push(token);
      return token;
    });
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.db.read().refreshTokens.find((token) => token.tokenHash === tokenHash) ?? null;
  }

  async revokeById(id: string, at: Date): Promise<void> {
    await this.db.mutate((data) => {
      const token = data.refreshTokens.find((candidate) => candidate.id === id);
      if (token && !token.revokedAt) token.revokedAt = at.toISOString();
    });
  }

  async revokeByHash(tokenHash: string, at: Date): Promise<void> {
    await this.db.mutate((data) => {
      for (const token of data.refreshTokens) {
        if (token.tokenHash === tokenHash && !token.revokedAt) token.revokedAt = at.toISOString();
      }
    });
  }

  async revokeAllForUser(userId: string, at: Date): Promise<void> {
    await this.db.mutate((data) => {
      for (const token of data.refreshTokens) {
        if (token.userId === userId && !token.revokedAt) token.revokedAt = at.toISOString();
      }
    });
  }
}

@Injectable()
export class JsonAuditRepository implements AuditRepository {
  constructor(private readonly db: JsonDatabase) {}

  async append(rows: AuditRow[]): Promise<void> {
    if (rows.length === 0) return;
    const now = new Date().toISOString();
    const entries: AuditLog[] = rows.map((row) => ({
      ...row,
      id: row.id ?? randomUUID(),
      occurredAt: row.occurredAt ?? now,
    }));
    // Append-only: existing entries are never rewritten or removed.
    await this.db.mutate((data) => {
      data.auditLogs.push(...entries);
    });
  }

  async list(query: AuditQuery): Promise<{ items: AuditListItem[]; nextCursor: string | null }> {
    const data = this.db.read();
    const matching = data.auditLogs
      .filter((row) => (query.entityType ? row.entityType === query.entityType : true))
      .filter((row) => (query.entityId ? row.entityId === query.entityId : true))
      .filter((row) => (query.actorId ? row.actorId === query.actorId : true))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

    const start = query.cursor ? matching.findIndex((row) => row.id === query.cursor) + 1 : 0;
    const page = matching.slice(start, start + query.limit);
    const hasMore = matching.length > start + page.length;

    const items = page.map((row) => {
      const actor = row.actorId
        ? data.users.find((user) => user.id === row.actorId)
        : undefined;
      return {
        ...row,
        actor: actor ? { id: actor.id, name: actor.name, email: actor.email } : null,
      };
    });

    return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
  }
}

@Injectable()
export class JsonCustomerAccountRepository implements CustomerAccountRepository {
  constructor(private readonly db: JsonDatabase) {}

  async findByDomain(domain: string): Promise<CustomerAccount | null> {
    return this.db.read().customerAccounts.find((account) => account.domain === domain) ?? null;
  }

  async create(input: { name: string; domain: string }): Promise<CustomerAccount> {
    const account: CustomerAccount = {
      id: randomUUID(),
      name: input.name,
      domain: input.domain,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    return this.db.mutate((data) => {
      data.customerAccounts.push(account);
      return account;
    });
  }
}
