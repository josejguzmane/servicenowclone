import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const ROLES = [
  { key: 'end_user', name: 'End User', description: 'Requester: own tickets only' },
  { key: 'agent', name: 'Support Engineer', description: 'Works tickets in their groups' },
  { key: 'team_lead', name: 'Team Lead', description: 'Assigns, overrides, reports on groups' },
  { key: 'admin', name: 'Administrator', description: 'Full configuration access' },
  { key: 'auditor', name: 'Auditor', description: 'Read-only access including the audit log' },
];

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'ChangeMe123!secure';

async function main(): Promise<void> {
  for (const role of ROLES) {
    await prisma.role.upsert({ where: { key: role.key }, update: role, create: role });
  }

  const businessHours = await prisma.businessHours.upsert({
    where: { name: 'Standard 9-5 Mon-Fri' },
    update: {},
    create: {
      name: 'Standard 9-5 Mon-Fri',
      timezone: 'UTC',
      windowsJson: [1, 2, 3, 4, 5].map((day) => ({ day, start: '09:00', end: '17:00' })),
      holidaysJson: [],
    },
  });

  const serviceDesk = await prisma.group.upsert({
    where: { name: 'Service Desk' },
    update: {},
    create: {
      name: 'Service Desk',
      description: 'First line support',
      businessHoursId: businessHours.id,
    },
  });

  const infrastructure = await prisma.group.upsert({
    where: { name: 'Infrastructure' },
    update: {},
    create: {
      name: 'Infrastructure',
      description: 'Second line: networks, servers, storage',
      businessHoursId: businessHours.id,
    },
  });

  const hardware = await upsertCategory('Hardware', serviceDesk.id);
  const software = await upsertCategory('Software', serviceDesk.id);
  await upsertCategory('Network', infrastructure.id);
  await upsertCategory('Access & Accounts', serviceDesk.id);

  for (const [name, minutes] of [
    ['P1 - Critical', { response: 15, resolve: 240 }],
    ['P2 - High', { response: 60, resolve: 480 }],
    ['P3 - Normal', { response: 240, resolve: 2400 }],
    ['P4 - Low', { response: 480, resolve: 4800 }],
  ] as const) {
    const priority = name.slice(0, 2).toLowerCase();
    await prisma.slaPolicy.upsert({
      where: { name },
      update: {},
      create: {
        name,
        appliesToJson: { priority },
        precedence: 100,
        responseMinutes: minutes.response,
        resolveMinutes: minutes.resolve,
        businessHoursId: businessHours.id,
      },
    });
  }

  const acme = await prisma.customerAccount.upsert({
    where: { domain: 'acme.example' },
    update: {},
    create: { name: 'Acme Corp', domain: 'acme.example' },
  });

  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  const admin = await upsertUser({
    email: 'admin@example.com',
    name: 'Ada Admin',
    kind: 'internal',
    passwordHash,
    roles: ['admin'],
  });

  const lead = await upsertUser({
    email: 'lead@example.com',
    name: 'Leo Lead',
    kind: 'internal',
    passwordHash,
    roles: ['team_lead'],
  });

  const agent = await upsertUser({
    email: 'agent@example.com',
    name: 'Sam Support',
    kind: 'internal',
    passwordHash,
    roles: ['agent'],
  });

  const employee = await upsertUser({
    email: 'employee@example.com',
    name: 'Erin Employee',
    kind: 'internal',
    passwordHash,
    roles: ['end_user'],
  });

  const customer = await upsertUser({
    email: 'customer@acme.example',
    name: 'Cara Customer',
    kind: 'external',
    passwordHash,
    roles: ['end_user'],
    customerAccountId: acme.id,
    isAccountAdmin: true,
  });

  await addToGroup(serviceDesk.id, lead.id, true);
  await addToGroup(serviceDesk.id, agent.id, false);
  await addToGroup(infrastructure.id, lead.id, true);

  await prisma.catalogItem.upsert({
    where: { slug: 'new-laptop' },
    update: {},
    create: {
      name: 'New laptop',
      slug: 'new-laptop',
      description: 'Request a replacement or additional laptop',
      categoryId: hardware.id,
      defaultGroupId: serviceDesk.id,
      approvalRequired: true,
      formSchemaJson: {
        type: 'object',
        required: ['model', 'justification'],
        properties: {
          model: { type: 'string', title: 'Model', enum: ['Standard', 'Developer', 'Design'] },
          justification: { type: 'string', title: 'Business justification', maxLength: 500 },
          neededBy: { type: 'string', title: 'Needed by', format: 'date' },
        },
      },
    },
  });

  await prisma.catalogItem.upsert({
    where: { slug: 'software-licence' },
    update: {},
    create: {
      name: 'Software licence',
      slug: 'software-licence',
      description: 'Request a licence for approved software',
      categoryId: software.id,
      defaultGroupId: serviceDesk.id,
      approvalRequired: true,
      formSchemaJson: {
        type: 'object',
        required: ['product'],
        properties: {
          product: { type: 'string', title: 'Product' },
          seats: { type: 'integer', title: 'Seats', minimum: 1, default: 1 },
        },
      },
    },
  });

  console.log('Seed complete.');
  console.table([
    { email: admin.email, role: 'admin' },
    { email: lead.email, role: 'team_lead' },
    { email: agent.email, role: 'agent' },
    { email: employee.email, role: 'end_user (internal)' },
    { email: customer.email, role: 'end_user (external, Acme)' },
  ]);
  console.log(`Password for all seeded users: ${DEMO_PASSWORD}`);
}

async function upsertCategory(name: string, defaultGroupId: string) {
  const existing = await prisma.category.findFirst({ where: { name, parentId: null } });
  if (existing) return existing;
  return prisma.category.create({ data: { name, defaultGroupId } });
}

async function upsertUser(input: {
  email: string;
  name: string;
  kind: 'internal' | 'external';
  passwordHash: string;
  roles: string[];
  customerAccountId?: string;
  isAccountAdmin?: boolean;
}) {
  const roles = await prisma.role.findMany({ where: { key: { in: input.roles } } });
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      kind: input.kind,
      customerAccountId: input.customerAccountId ?? null,
      isAccountAdmin: input.isAccountAdmin ?? false,
    },
    create: {
      email: input.email,
      name: input.name,
      kind: input.kind,
      passwordHash: input.passwordHash,
      emailVerifiedAt: new Date(),
      customerAccountId: input.customerAccountId ?? null,
      isAccountAdmin: input.isAccountAdmin ?? false,
    },
  });

  for (const role of roles) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
  }
  return user;
}

async function addToGroup(groupId: string, userId: string, isLead: boolean) {
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId, userId } },
    update: { isLead },
    create: { groupId, userId, isLead },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
