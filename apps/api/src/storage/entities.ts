import type {
  ApprovalState,
  CommentVisibility,
  Impact,
  PendingReason,
  Priority,
  TicketStatus,
  TicketType,
  Urgency,
} from '@servicedesk/shared';

/**
 * Persistence-facing entity shapes. Timestamps are ISO-8601 strings so a record
 * survives a JSON round trip unchanged; convert at the edges where you need a
 * `Date`. These mirror `prisma/schema.prisma`, which stays the target shape for
 * the eventual database driver.
 */

export type UserKind = 'internal' | 'external';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'assign'
  | 'escalate'
  | 'approve'
  | 'reject'
  | 'comment'
  | 'attach'
  | 'export';

export interface CustomerAccount {
  id: string;
  name: string;
  domain: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  kind: UserKind;
  customerAccountId: string | null;
  isAccountAdmin: boolean;
  department: string | null;
  passwordHash: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
}

export interface UserRole {
  userId: string;
  roleId: string;
}

export interface Group {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface GroupMember {
  groupId: string;
  userId: string;
  isLead: boolean;
}

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  action: AuditAction;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  source: 'ui' | 'api' | 'email' | 'system';
  requestId: string | null;
  ip: string | null;
  userAgent: string | null;
  occurredAt: string;
}

export interface Category {
  id: string;
  key: string;
  name: string;
  parentId: string | null;
  defaultGroupId: string | null;
  isActive: boolean;
}

export interface CatalogItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  formSchema: unknown;
  approvalChain: unknown;
  fulfilmentGroupId: string | null;
  isActive: boolean;
}

export interface SlaPolicy {
  id: string;
  key: string;
  name: string;
  priority: Priority;
  respondWithinMinutes: number;
  resolveWithinMinutes: number;
  businessHoursId: string | null;
  isActive: boolean;
}

export interface Ticket {
  id: string;
  number: string;
  type: TicketType;
  subject: string;
  description: string;
  status: TicketStatus;
  pendingReason: PendingReason | null;
  impact: Impact;
  urgency: Urgency;
  priority: Priority;
  requesterId: string;
  customerAccountId: string | null;
  assigneeId: string | null;
  assignmentGroupId: string | null;
  categoryId: string | null;
  catalogItemId: string | null;
  formData: unknown;
  respondDueAt: string | null;
  resolveDueAt: string | null;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  ticketId: string;
  authorId: string | null;
  body: string;
  visibility: CommentVisibility;
  createdAt: string;
}

export interface ApprovalStep {
  id: string;
  ticketId: string;
  sequence: number;
  approverId: string | null;
  approverGroupId: string | null;
  state: ApprovalState;
  decidedAt: string | null;
  comment: string | null;
}

/** Every collection the application persists, in one document. */
export interface DatabaseShape {
  customerAccounts: CustomerAccount[];
  users: User[];
  roles: Role[];
  userRoles: UserRole[];
  groups: Group[];
  groupMembers: GroupMember[];
  refreshTokens: RefreshToken[];
  categories: Category[];
  catalogItems: CatalogItem[];
  slaPolicies: SlaPolicy[];
  tickets: Ticket[];
  comments: Comment[];
  approvalSteps: ApprovalStep[];
  auditLogs: AuditLog[];
  ticketSequence: Record<string, number>;
}

export function emptyDatabase(): DatabaseShape {
  return {
    customerAccounts: [],
    users: [],
    roles: [],
    userRoles: [],
    groups: [],
    groupMembers: [],
    refreshTokens: [],
    categories: [],
    catalogItems: [],
    slaPolicies: [],
    tickets: [],
    comments: [],
    approvalSteps: [],
    auditLogs: [],
    ticketSequence: {},
  };
}
