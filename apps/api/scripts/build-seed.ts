/**
 * Regenerates `data/seed.json`, the demo dataset the JSON store starts from.
 *
 * Run with `pnpm seed:build`. IDs and the password salt are fixed so
 * regenerating the file is reproducible and produces an empty diff when nothing
 * changed. The fixed salt is acceptable only because this is a throwaway demo
 * credential — real accounts are hashed with a random salt at registration.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import * as argon2 from 'argon2';
import { emptyDatabase, type DatabaseShape } from '../src/storage/entities';

const OUTPUT = resolve(__dirname, '../data/seed.json');
const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'ChangeMe123!secure';
const NOW = '2025-01-01T00:00:00.000Z';
const SEED_SALT = Buffer.from('servicedeskseed0', 'utf8');

const ID = {
  roles: {
    end_user: '00000000-0000-4000-8000-000000000101',
    agent: '00000000-0000-4000-8000-000000000102',
    team_lead: '00000000-0000-4000-8000-000000000103',
    admin: '00000000-0000-4000-8000-000000000104',
    auditor: '00000000-0000-4000-8000-000000000105',
  },
  groups: {
    serviceDesk: '00000000-0000-4000-8000-000000000201',
    infrastructure: '00000000-0000-4000-8000-000000000202',
  },
  users: {
    admin: '00000000-0000-4000-8000-000000000301',
    lead: '00000000-0000-4000-8000-000000000302',
    agent: '00000000-0000-4000-8000-000000000303',
    employee: '00000000-0000-4000-8000-000000000304',
    customer: '00000000-0000-4000-8000-000000000305',
  },
  categories: {
    hardware: '00000000-0000-4000-8000-000000000401',
    software: '00000000-0000-4000-8000-000000000402',
    network: '00000000-0000-4000-8000-000000000403',
    access: '00000000-0000-4000-8000-000000000404',
  },
  accounts: {
    acme: '00000000-0000-4000-8000-000000000501',
  },
  catalog: {
    laptop: '00000000-0000-4000-8000-000000000601',
    licence: '00000000-0000-4000-8000-000000000602',
  },
  sla: {
    p1: '00000000-0000-4000-8000-000000000701',
    p2: '00000000-0000-4000-8000-000000000702',
    p3: '00000000-0000-4000-8000-000000000703',
    p4: '00000000-0000-4000-8000-000000000704',
  },
} as const;

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(DEMO_PASSWORD, {
    type: argon2.argon2id,
    salt: SEED_SALT,
  });

  const data: DatabaseShape = {
    ...emptyDatabase(),

    roles: [
      { id: ID.roles.end_user, key: 'end_user', name: 'End User', description: 'Requester: own tickets only' },
      { id: ID.roles.agent, key: 'agent', name: 'Support Engineer', description: 'Works tickets in their groups' },
      { id: ID.roles.team_lead, key: 'team_lead', name: 'Team Lead', description: 'Assigns, overrides, reports on groups' },
      { id: ID.roles.admin, key: 'admin', name: 'Administrator', description: 'Full configuration access' },
      { id: ID.roles.auditor, key: 'auditor', name: 'Auditor', description: 'Read-only access including the audit log' },
    ],

    customerAccounts: [
      { id: ID.accounts.acme, name: 'Acme Corp', domain: 'acme.example', isActive: true, createdAt: NOW },
    ],

    groups: [
      { id: ID.groups.serviceDesk, key: 'service-desk', name: 'Service Desk', description: 'First line support', isActive: true },
      { id: ID.groups.infrastructure, key: 'infrastructure', name: 'Infrastructure', description: 'Second line: networks, servers, storage', isActive: true },
    ],

    users: [
      user(ID.users.admin, 'admin@example.com', 'Ada Admin', passwordHash),
      user(ID.users.lead, 'lead@example.com', 'Leo Lead', passwordHash),
      user(ID.users.agent, 'agent@example.com', 'Sam Support', passwordHash),
      user(ID.users.employee, 'employee@example.com', 'Erin Employee', passwordHash),
      {
        ...user(ID.users.customer, 'customer@acme.example', 'Cara Customer', passwordHash),
        kind: 'external',
        customerAccountId: ID.accounts.acme,
        isAccountAdmin: true,
      },
    ],

    userRoles: [
      { userId: ID.users.admin, roleId: ID.roles.admin },
      { userId: ID.users.lead, roleId: ID.roles.team_lead },
      { userId: ID.users.agent, roleId: ID.roles.agent },
      { userId: ID.users.employee, roleId: ID.roles.end_user },
      { userId: ID.users.customer, roleId: ID.roles.end_user },
    ],

    groupMembers: [
      { groupId: ID.groups.serviceDesk, userId: ID.users.lead, isLead: true },
      { groupId: ID.groups.serviceDesk, userId: ID.users.agent, isLead: false },
      { groupId: ID.groups.infrastructure, userId: ID.users.lead, isLead: true },
    ],

    categories: [
      category(ID.categories.hardware, 'hardware', 'Hardware', ID.groups.serviceDesk),
      category(ID.categories.software, 'software', 'Software', ID.groups.serviceDesk),
      category(ID.categories.network, 'network', 'Network', ID.groups.infrastructure),
      category(ID.categories.access, 'access-accounts', 'Access & Accounts', ID.groups.serviceDesk),
    ],

    slaPolicies: [
      sla(ID.sla.p1, 'p1', 'P1 - Critical', 15, 240),
      sla(ID.sla.p2, 'p2', 'P2 - High', 60, 480),
      sla(ID.sla.p3, 'p3', 'P3 - Normal', 240, 2400),
      sla(ID.sla.p4, 'p4', 'P4 - Low', 480, 4800),
    ],

    catalogItems: [
      {
        id: ID.catalog.laptop,
        key: 'new-laptop',
        name: 'New laptop',
        description: 'Request a replacement or additional laptop',
        categoryId: ID.categories.hardware,
        fulfilmentGroupId: ID.groups.serviceDesk,
        isActive: true,
        approvalChain: [{ sequence: 1, approverGroupId: ID.groups.serviceDesk }],
        formSchema: {
          type: 'object',
          required: ['model', 'justification'],
          properties: {
            model: { type: 'string', title: 'Model', enum: ['Standard', 'Developer', 'Design'] },
            justification: { type: 'string', title: 'Business justification', maxLength: 500 },
            neededBy: { type: 'string', title: 'Needed by', format: 'date' },
          },
        },
      },
      {
        id: ID.catalog.licence,
        key: 'software-licence',
        name: 'Software licence',
        description: 'Request a licence for approved software',
        categoryId: ID.categories.software,
        fulfilmentGroupId: ID.groups.serviceDesk,
        isActive: true,
        approvalChain: [{ sequence: 1, approverGroupId: ID.groups.serviceDesk }],
        formSchema: {
          type: 'object',
          required: ['product'],
          properties: {
            product: { type: 'string', title: 'Product' },
            seats: { type: 'integer', title: 'Seats', minimum: 1, default: 1 },
          },
        },
      },
    ],
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  console.log(`Wrote ${OUTPUT}`);
  console.log(`Demo password for all seeded users: ${DEMO_PASSWORD}`);
}

function user(id: string, email: string, name: string, passwordHash: string) {
  return {
    id,
    email,
    name,
    kind: 'internal' as const,
    customerAccountId: null,
    isAccountAdmin: false,
    department: null,
    passwordHash,
    isActive: true,
    lastLoginAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function category(id: string, key: string, name: string, defaultGroupId: string) {
  return { id, key, name, parentId: null, defaultGroupId, isActive: true };
}

function sla(
  id: string,
  priority: 'p1' | 'p2' | 'p3' | 'p4',
  name: string,
  respondWithinMinutes: number,
  resolveWithinMinutes: number,
) {
  return {
    id,
    key: priority,
    name,
    priority,
    respondWithinMinutes,
    resolveWithinMinutes,
    businessHoursId: null,
    isActive: true,
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
