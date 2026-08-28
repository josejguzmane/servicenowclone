/** Ticket domain constants shared by the API and both frontends. */

export const TICKET_TYPES = ['incident', 'service_request'] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const TICKET_STATUSES = [
  'new',
  'pending_approval',
  'triaged',
  'assigned',
  'in_progress',
  'pending',
  'resolved',
  'closed',
  'cancelled',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Why a ticket is waiting; `customer` and `approval` pause the resolution SLA. */
export const PENDING_REASONS = ['customer', 'vendor', 'approval'] as const;
export type PendingReason = (typeof PENDING_REASONS)[number];

export const SLA_PAUSING_PENDING_REASONS: readonly PendingReason[] = ['customer', 'approval'];

export const IMPACTS = ['low', 'medium', 'high'] as const;
export type Impact = (typeof IMPACTS)[number];

export const URGENCIES = ['low', 'medium', 'high'] as const;
export type Urgency = (typeof URGENCIES)[number];

export const PRIORITIES = ['p1', 'p2', 'p3', 'p4'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Impact x urgency -> priority. Leads may override, which is audit logged with a reason. */
const PRIORITY_MATRIX: Record<Impact, Record<Urgency, Priority>> = {
  high: { high: 'p1', medium: 'p2', low: 'p3' },
  medium: { high: 'p2', medium: 'p3', low: 'p3' },
  low: { high: 'p3', medium: 'p3', low: 'p4' },
};

export function derivePriority(impact: Impact, urgency: Urgency): Priority {
  return PRIORITY_MATRIX[impact][urgency];
}

export const COMMENT_VISIBILITIES = ['public_reply', 'work_note', 'system'] as const;
export type CommentVisibility = (typeof COMMENT_VISIBILITIES)[number];

export const APPROVAL_STATES = ['not_required', 'pending', 'approved', 'rejected'] as const;
export type ApprovalState = (typeof APPROVAL_STATES)[number];

/**
 * Allowed status transitions per ticket type. Enforced server-side; the admin
 * console edits the same table in a later phase so new states need no deploy.
 */
export const TRANSITIONS: Record<TicketType, Record<TicketStatus, readonly TicketStatus[]>> = {
  incident: {
    new: ['triaged', 'assigned', 'in_progress', 'cancelled'],
    pending_approval: [],
    triaged: ['assigned', 'in_progress', 'cancelled'],
    assigned: ['in_progress', 'pending', 'resolved', 'triaged', 'cancelled'],
    in_progress: ['pending', 'resolved', 'assigned', 'cancelled'],
    pending: ['in_progress', 'resolved', 'cancelled'],
    resolved: ['closed', 'in_progress'],
    closed: ['in_progress'],
    cancelled: [],
  },
  service_request: {
    new: ['pending_approval', 'assigned', 'in_progress', 'cancelled'],
    pending_approval: ['assigned', 'in_progress', 'closed', 'cancelled'],
    triaged: ['assigned', 'in_progress', 'cancelled'],
    assigned: ['in_progress', 'pending', 'resolved', 'cancelled'],
    in_progress: ['pending', 'resolved', 'cancelled'],
    pending: ['in_progress', 'resolved', 'cancelled'],
    resolved: ['closed', 'in_progress'],
    closed: ['in_progress'],
    cancelled: [],
  },
};

export function canTransition(
  type: TicketType,
  from: TicketStatus,
  to: TicketStatus,
): boolean {
  return TRANSITIONS[type][from]?.includes(to) ?? false;
}

export const OPEN_STATUSES: readonly TicketStatus[] = [
  'new',
  'pending_approval',
  'triaged',
  'assigned',
  'in_progress',
  'pending',
];

export function isOpen(status: TicketStatus): boolean {
  return OPEN_STATUSES.includes(status);
}
