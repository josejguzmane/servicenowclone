import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyDatabase } from '../entities';
import { JsonDatabase } from './json-database';
import {
  JsonAuditRepository,
  JsonRefreshTokenRepository,
  JsonUserRepository,
} from './json-repositories';

async function makeDatabase(): Promise<{ db: JsonDatabase; dir: string; dataFile: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'servicedesk-'));
  const dataFile = join(dir, 'data.json');
  const seedFile = join(dir, 'seed.json');

  const seed = emptyDatabase();
  seed.roles = [{ id: 'role-agent', key: 'agent', name: 'Agent', description: null }];
  seed.users = [
    {
      id: 'user-1',
      email: 'agent@example.com',
      name: 'Sam Support',
      kind: 'internal',
      customerAccountId: null,
      isAccountAdmin: false,
      department: null,
      passwordHash: 'hash',
      isActive: true,
      lastLoginAt: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
  ];
  seed.userRoles = [{ userId: 'user-1', roleId: 'role-agent' }];
  seed.groupMembers = [{ groupId: 'group-1', userId: 'user-1', isLead: true }];
  await writeFile(seedFile, JSON.stringify(seed), 'utf8');

  const config = { getOrThrow: () => ({ dataFile, seedFile }) };
  const db = new JsonDatabase(config as never);
  await db.load();
  return { db, dir, dataFile };
}

describe('JsonDatabase', () => {
  let db: JsonDatabase;
  let dir: string;
  let dataFile: string;

  beforeEach(async () => {
    ({ db, dir, dataFile } = await makeDatabase());
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('starts the working copy from the seed without mutating the seed file', async () => {
    const users = new JsonUserRepository(db);
    await users.recordLogin('user-1', new Date('2025-06-01T12:00:00.000Z'));

    const persisted = JSON.parse(await readFile(dataFile, 'utf8')) as { users: unknown[] };
    expect(persisted.users).toHaveLength(1);
  });

  it('persists every mutation to disk before resolving', async () => {
    const users = new JsonUserRepository(db);
    const created = await users.create({
      email: 'new@acme.example',
      name: 'New Contact',
      kind: 'external',
      customerAccountId: 'account-1',
      passwordHash: 'hash',
      roleKeys: ['agent'],
    });

    const persisted = JSON.parse(await readFile(dataFile, 'utf8')) as {
      users: { id: string }[];
      userRoles: { userId: string; roleId: string }[];
    };
    expect(persisted.users.map((user) => user.id)).toContain(created.id);
    expect(persisted.userRoles).toContainEqual({ userId: created.id, roleId: 'role-agent' });
  });

  it('resolves roles and group memberships for a principal', async () => {
    const access = await new JsonUserRepository(db).findWithAccess('user-1');
    expect(access?.roles.map((role) => role.key)).toEqual(['agent']);
    expect(access?.memberships).toEqual([{ groupId: 'group-1', userId: 'user-1', isLead: true }]);
  });

  it('excludes external contacts from a staff-scoped directory search', async () => {
    const users = new JsonUserRepository(db);
    await users.create({
      email: 'cara@acme.example',
      name: 'Cara Customer',
      kind: 'external',
      customerAccountId: 'account-1',
      passwordHash: 'hash',
      roleKeys: [],
    });

    const staffOnly = await users.search({ kind: 'internal', limit: 25 });
    expect(staffOnly.map((user) => user.email)).toEqual(['agent@example.com']);
  });
});

describe('JsonRefreshTokenRepository', () => {
  it('marks a rotated token revoked so it cannot be replayed', async () => {
    const { db, dir } = await makeDatabase();
    const tokens = new JsonRefreshTokenRepository(db);

    const token = await tokens.create({
      userId: 'user-1',
      tokenHash: 'hash-1',
      expiresAt: new Date(Date.now() + 60_000),
    });
    await tokens.revokeById(token.id, new Date());

    expect((await tokens.findByHash('hash-1'))?.revokedAt).not.toBeNull();
    await rm(dir, { recursive: true, force: true });
  });
});

describe('JsonAuditRepository', () => {
  it('returns newest first, paginates by cursor and joins the actor', async () => {
    const { db, dir } = await makeDatabase();
    const audit = new JsonAuditRepository(db);

    for (const [index, occurredAt] of [
      '2025-01-01T00:00:00.000Z',
      '2025-01-02T00:00:00.000Z',
      '2025-01-03T00:00:00.000Z',
    ].entries()) {
      await audit.append([
        {
          id: `audit-${index}`,
          occurredAt,
          entityType: 'user',
          entityId: 'user-1',
          actorId: 'user-1',
          action: 'login',
          field: null,
          oldValue: null,
          newValue: null,
          reason: null,
          source: 'ui',
          requestId: null,
          ip: null,
          userAgent: null,
        },
      ]);
    }

    const first = await audit.list({ limit: 2 });
    expect(first.items.map((row) => row.id)).toEqual(['audit-2', 'audit-1']);
    expect(first.items[0]?.actor?.email).toBe('agent@example.com');
    expect(first.nextCursor).toBe('audit-1');

    const second = await audit.list({ limit: 2, cursor: first.nextCursor ?? undefined });
    expect(second.items.map((row) => row.id)).toEqual(['audit-0']);
    expect(second.nextCursor).toBeNull();

    await rm(dir, { recursive: true, force: true });
  });
});
