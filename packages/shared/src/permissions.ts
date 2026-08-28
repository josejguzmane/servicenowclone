/**
 * Permission catalog and role mapping.
 *
 * Authorization is permission-based, never role-string based: services ask
 * `can(actor, permission, resource)` and the role -> permission map below is the
 * only place where roles are expanded.
 */

export const PERMISSIONS = [
  // tickets
  'ticket.create',
  'ticket.read.own',
  'ticket.read.account',
  'ticket.read.group',
  'ticket.read.any',
  'ticket.update.own',
  'ticket.update.group',
  'ticket.update.any',
  'ticket.assign',
  'ticket.assign.cross_group',
  'ticket.resolve',
  'ticket.close',
  'ticket.reopen',
  'ticket.cancel',
  'ticket.priority.override',
  'ticket.escalate',
  'ticket.bulk_update',
  // comments
  'comment.public.create',
  'comment.worknote.read',
  'comment.worknote.create',
  // catalog & approvals
  'catalog.read',
  'catalog.manage',
  'approval.decide',
  'approval.manage',
  // knowledge base
  'kb.read',
  'kb.manage',
  // administration
  'sla.manage',
  'escalation.manage',
  'routing.manage',
  'category.manage',
  'group.manage',
  'group.manage.own',
  'user.read',
  'user.manage',
  'account.manage',
  'audit.read',
  'report.read.own',
  'report.read.group',
  'report.read.any',
  'export.data',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = ['end_user', 'agent', 'team_lead', 'admin', 'auditor'] as const;
export type RoleKey = (typeof ROLES)[number];

const END_USER: Permission[] = [
  'ticket.create',
  'ticket.read.own',
  'ticket.update.own',
  'ticket.close',
  'ticket.reopen',
  'ticket.escalate',
  'comment.public.create',
  'catalog.read',
  'kb.read',
  'report.read.own',
];

const AGENT: Permission[] = [
  ...END_USER,
  'ticket.read.group',
  'ticket.update.group',
  'ticket.assign',
  'ticket.resolve',
  'ticket.cancel',
  'comment.worknote.read',
  'comment.worknote.create',
  'user.read',
  'report.read.group',
];

const TEAM_LEAD: Permission[] = [
  ...AGENT,
  'ticket.assign.cross_group',
  'ticket.priority.override',
  'ticket.bulk_update',
  'group.manage.own',
  'approval.manage',
  'kb.manage',
  'export.data',
];

const ADMIN: Permission[] = [
  ...TEAM_LEAD,
  'ticket.read.any',
  'ticket.update.any',
  'catalog.manage',
  'sla.manage',
  'escalation.manage',
  'routing.manage',
  'category.manage',
  'group.manage',
  'user.manage',
  'account.manage',
  'audit.read',
  'report.read.any',
];

const AUDITOR: Permission[] = [
  'ticket.read.any',
  'comment.worknote.read',
  'audit.read',
  'report.read.any',
  'user.read',
  'kb.read',
  'catalog.read',
];

export const ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  end_user: dedupe(END_USER),
  agent: dedupe(AGENT),
  team_lead: dedupe(TEAM_LEAD),
  admin: dedupe(ADMIN),
  auditor: dedupe(AUDITOR),
};

function dedupe(permissions: Permission[]): Permission[] {
  return [...new Set(permissions)].sort();
}

export function permissionsForRoles(roles: readonly RoleKey[]): Permission[] {
  const result = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) {
      result.add(permission);
    }
  }
  return [...result].sort();
}

/**
 * Read scope for ticket queries, widest wins. `account` only ever applies to
 * external contacts and is always intersected with their customerAccountId.
 */
export type ReadScope = 'own' | 'account' | 'group' | 'any';

export function readScopeFor(permissions: readonly Permission[]): ReadScope {
  if (permissions.includes('ticket.read.any')) return 'any';
  if (permissions.includes('ticket.read.group')) return 'group';
  if (permissions.includes('ticket.read.account')) return 'account';
  return 'own';
}
