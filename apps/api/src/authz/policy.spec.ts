import { permissionsForRoles, type Actor, type RoleKey } from '@servicedesk/shared';
import {
  canReadTicket,
  canTicketAction,
  scopeFor,
  ticketScopeFilter,
  type TicketSubject,
} from './policy';

function actor(overrides: Partial<Actor> & { roles: RoleKey[] }): Actor {
  return {
    userId: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    kind: 'internal',
    customerAccountId: null,
    isAccountAdmin: false,
    permissions: permissionsForRoles(overrides.roles),
    groupIds: [],
    leadGroupIds: [],
    ...overrides,
  };
}

function ticket(overrides: Partial<TicketSubject> = {}): TicketSubject {
  return {
    id: 'ticket-1',
    requesterId: 'requester-1',
    customerAccountId: null,
    assignmentGroupId: 'group-1',
    assigneeId: null,
    status: 'in_progress',
    ...overrides,
  };
}

describe('read scope', () => {
  it('gives admins global scope and end users own scope', () => {
    expect(scopeFor(actor({ roles: ['admin'] }))).toBe('any');
    expect(scopeFor(actor({ roles: ['agent'] }))).toBe('group');
    expect(scopeFor(actor({ roles: ['end_user'] }))).toBe('own');
  });

  it('never widens an external contact beyond their own account', () => {
    const rogue = actor({
      roles: ['admin'],
      kind: 'external',
      customerAccountId: 'acct-1',
      isAccountAdmin: true,
    });
    expect(scopeFor(rogue)).toBe('account');

    const contact = actor({ roles: ['admin'], kind: 'external', customerAccountId: 'acct-1' });
    expect(scopeFor(contact)).toBe('own');
  });
});

describe('canReadTicket', () => {
  it('lets a requester read their own ticket', () => {
    const user = actor({ roles: ['end_user'], userId: 'requester-1' });
    expect(canReadTicket(user, ticket()).allowed).toBe(true);
  });

  it('hides other users tickets from an end user', () => {
    const user = actor({ roles: ['end_user'] });
    expect(canReadTicket(user, ticket()).allowed).toBe(false);
  });

  it('isolates external contacts across customer accounts', () => {
    const contactA = actor({
      roles: ['end_user'],
      kind: 'external',
      customerAccountId: 'acct-a',
      isAccountAdmin: true,
    });
    expect(canReadTicket(contactA, ticket({ customerAccountId: 'acct-a' })).allowed).toBe(true);
    expect(canReadTicket(contactA, ticket({ customerAccountId: 'acct-b' })).allowed).toBe(false);
  });

  it('gives agents access to tickets in their groups only', () => {
    const agent = actor({ roles: ['agent'], groupIds: ['group-1'] });
    expect(canReadTicket(agent, ticket({ assignmentGroupId: 'group-1' })).allowed).toBe(true);
    expect(canReadTicket(agent, ticket({ assignmentGroupId: 'group-9' })).allowed).toBe(false);
  });

  it('gives an agent access to a ticket assigned to them outside their groups', () => {
    const agent = actor({ roles: ['agent'], groupIds: ['group-1'] });
    const subject = ticket({ assignmentGroupId: 'group-9', assigneeId: 'user-1' });
    expect(canReadTicket(agent, subject).allowed).toBe(true);
  });
});

describe('canTicketAction', () => {
  it('refuses work notes to end users and allows them to agents', () => {
    const user = actor({ roles: ['end_user'], userId: 'requester-1' });
    const agent = actor({ roles: ['agent'], groupIds: ['group-1'] });
    expect(canTicketAction(user, 'comment_internal', ticket()).allowed).toBe(false);
    expect(canTicketAction(agent, 'comment_internal', ticket()).allowed).toBe(true);
  });

  it('only lets leads override priority', () => {
    const agent = actor({ roles: ['agent'], groupIds: ['group-1'] });
    const lead = actor({ roles: ['team_lead'], groupIds: ['group-1'] });
    expect(canTicketAction(agent, 'override_priority', ticket()).allowed).toBe(false);
    expect(canTicketAction(lead, 'override_priority', ticket()).allowed).toBe(true);
  });

  it('restricts cross-group assignment to leads and admins', () => {
    const agent = actor({ roles: ['agent'], groupIds: ['group-1'] });
    const lead = actor({ roles: ['team_lead'], groupIds: ['group-1'] });
    const foreign = ticket({ assignmentGroupId: 'group-9', requesterId: 'user-1' });
    expect(canTicketAction(agent, 'assign', foreign).allowed).toBe(false);
    expect(canTicketAction(lead, 'assign', foreign).allowed).toBe(true);
  });

  it('stops a requester editing a closed ticket but allows reopening it', () => {
    const user = actor({ roles: ['end_user'], userId: 'requester-1' });
    const closed = ticket({ status: 'closed' });
    expect(canTicketAction(user, 'update', closed).allowed).toBe(false);
    expect(canTicketAction(user, 'reopen', closed).allowed).toBe(true);
  });

  it('rejects reopening a ticket that is still open', () => {
    const user = actor({ roles: ['end_user'], userId: 'requester-1' });
    expect(canTicketAction(user, 'reopen', ticket({ status: 'in_progress' })).allowed).toBe(false);
  });

  it('does not let an auditor mutate anything', () => {
    const auditor = actor({ roles: ['auditor'] });
    expect(canReadTicket(auditor, ticket()).allowed).toBe(true);
    for (const action of ['update', 'assign', 'resolve', 'cancel'] as const) {
      expect(canTicketAction(auditor, action, ticket()).allowed).toBe(false);
    }
  });
});

describe('ticketScopeFilter', () => {
  it('is unrestricted for admins', () => {
    expect(ticketScopeFilter(actor({ roles: ['admin'] }))).toEqual({ kind: 'all' });
  });

  it('pins external account admins to their account', () => {
    const contact = actor({
      roles: ['end_user'],
      kind: 'external',
      customerAccountId: 'acct-a',
      isAccountAdmin: true,
    });
    expect(ticketScopeFilter(contact)).toEqual({
      kind: 'restricted',
      customerAccountId: 'acct-a',
    });
  });

  it('pins plain end users to their own tickets', () => {
    expect(ticketScopeFilter(actor({ roles: ['end_user'] }))).toEqual({
      kind: 'restricted',
      requesterId: 'user-1',
    });
  });
});
