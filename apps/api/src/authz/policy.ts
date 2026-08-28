import type { Actor, Permission, ReadScope } from '@servicedesk/shared';
import { isOpen, readScopeFor, type TicketStatus } from '@servicedesk/shared';

/** The subset of a ticket the policy layer needs to make a decision. */
export interface TicketSubject {
  id?: string;
  requesterId: string;
  onBehalfOfId?: string | null;
  customerAccountId: string | null;
  assignmentGroupId: string | null;
  assigneeId: string | null;
  status: TicketStatus;
}

export type TicketAction =
  | 'read'
  | 'update'
  | 'comment_public'
  | 'comment_internal'
  | 'assign'
  | 'resolve'
  | 'close'
  | 'reopen'
  | 'cancel'
  | 'escalate'
  | 'override_priority';

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
}

const allow: PolicyDecision = { allowed: true };
const deny = (reason: string): PolicyDecision => ({ allowed: false, reason });

export function has(actor: Actor, permission: Permission): boolean {
  return actor.permissions.includes(permission);
}

export function scopeFor(actor: Actor): ReadScope {
  const scope = readScopeFor(actor.permissions);
  // An external contact never widens beyond their own account, whatever roles
  // they somehow accumulate.
  if (actor.kind === 'external') {
    return actor.isAccountAdmin ? 'account' : 'own';
  }
  return scope;
}

function isRequester(actor: Actor, ticket: TicketSubject): boolean {
  return ticket.requesterId === actor.userId || ticket.onBehalfOfId === actor.userId;
}

function inSameAccount(actor: Actor, ticket: TicketSubject): boolean {
  return (
    actor.customerAccountId !== null && ticket.customerAccountId === actor.customerAccountId
  );
}

function inActorGroup(actor: Actor, ticket: TicketSubject): boolean {
  return ticket.assignmentGroupId !== null && actor.groupIds.includes(ticket.assignmentGroupId);
}

export function canReadTicket(actor: Actor, ticket: TicketSubject): PolicyDecision {
  switch (scopeFor(actor)) {
    case 'any':
      return allow;
    case 'group':
      if (inActorGroup(actor, ticket) || ticket.assigneeId === actor.userId) return allow;
      if (isRequester(actor, ticket)) return allow;
      return deny('ticket belongs to another assignment group');
    case 'account':
      if (isRequester(actor, ticket) || inSameAccount(actor, ticket)) return allow;
      return deny('ticket belongs to another customer account');
    case 'own':
    default:
      return isRequester(actor, ticket) ? allow : deny('not the requester');
  }
}

export function canTicketAction(
  actor: Actor,
  action: TicketAction,
  ticket: TicketSubject,
): PolicyDecision {
  const readable = canReadTicket(actor, ticket);
  if (!readable.allowed) return readable;

  const anyUpdate = has(actor, 'ticket.update.any');
  const groupUpdate = has(actor, 'ticket.update.group') && inActorGroup(actor, ticket);
  const assignedToActor = ticket.assigneeId === actor.userId;
  const agentOnTicket = anyUpdate || groupUpdate || assignedToActor;

  switch (action) {
    case 'read':
      return allow;

    case 'update':
      if (agentOnTicket) return allow;
      // Requesters may only add information while the ticket is still open.
      if (isRequester(actor, ticket) && has(actor, 'ticket.update.own') && isOpen(ticket.status)) {
        return allow;
      }
      return deny('no write access to this ticket');

    case 'comment_public':
      if (!has(actor, 'comment.public.create')) return deny('missing comment.public.create');
      if (ticket.status === 'cancelled') return deny('ticket is cancelled');
      return allow;

    case 'comment_internal':
      return has(actor, 'comment.worknote.create')
        ? allow
        : deny('work notes are internal to support staff');

    case 'assign':
      if (!has(actor, 'ticket.assign')) return deny('missing ticket.assign');
      if (anyUpdate || has(actor, 'ticket.assign.cross_group')) return allow;
      return inActorGroup(actor, ticket) ? allow : deny('ticket is outside your groups');

    case 'resolve':
      if (!has(actor, 'ticket.resolve')) return deny('missing ticket.resolve');
      return agentOnTicket ? allow : deny('only staff on the ticket may resolve it');

    case 'close':
      if (agentOnTicket) return allow;
      return isRequester(actor, ticket) && has(actor, 'ticket.close')
        ? allow
        : deny('cannot close this ticket');

    case 'reopen':
      if (!has(actor, 'ticket.reopen')) return deny('missing ticket.reopen');
      if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
        return deny('only resolved or closed tickets can be reopened');
      }
      return agentOnTicket || isRequester(actor, ticket) ? allow : deny('cannot reopen');

    case 'cancel':
      if (!has(actor, 'ticket.cancel')) return deny('missing ticket.cancel');
      return agentOnTicket ? allow : deny('only staff on the ticket may cancel it');

    case 'escalate':
      return has(actor, 'ticket.escalate') ? allow : deny('missing ticket.escalate');

    case 'override_priority':
      return has(actor, 'ticket.priority.override')
        ? allow
        : deny('priority is derived from impact and urgency');

    default: {
      const exhaustive: never = action;
      return deny(`unknown action ${String(exhaustive)}`);
    }
  }
}

/**
 * Mandatory query filter applied in the repository layer so scope cannot be
 * bypassed through list filters or pagination.
 */
export type TicketScopeFilter =
  | { kind: 'all' }
  | { kind: 'none' }
  | {
      kind: 'restricted';
      requesterId?: string;
      customerAccountId?: string;
      groupIds?: string[];
      assigneeId?: string;
    };

export function ticketScopeFilter(actor: Actor): TicketScopeFilter {
  switch (scopeFor(actor)) {
    case 'any':
      return { kind: 'all' };
    case 'group':
      return {
        kind: 'restricted',
        groupIds: actor.groupIds,
        assigneeId: actor.userId,
        requesterId: actor.userId,
      };
    case 'account':
      return actor.customerAccountId
        ? { kind: 'restricted', customerAccountId: actor.customerAccountId }
        : { kind: 'restricted', requesterId: actor.userId };
    case 'own':
    default:
      return { kind: 'restricted', requesterId: actor.userId };
  }
}
