import { permissionsForRoles, ROLE_PERMISSIONS, canTransition } from '@servicedesk/shared';

describe('role permissions', () => {
  it('is strictly increasing from end user to admin', () => {
    const endUser = new Set(ROLE_PERMISSIONS.end_user);
    const agent = new Set(ROLE_PERMISSIONS.agent);
    const lead = new Set(ROLE_PERMISSIONS.team_lead);
    const admin = new Set(ROLE_PERMISSIONS.admin);

    for (const permission of endUser) expect(agent.has(permission)).toBe(true);
    for (const permission of agent) expect(lead.has(permission)).toBe(true);
    for (const permission of lead) expect(admin.has(permission)).toBe(true);
  });

  it('never grants an end user internal work notes or audit access', () => {
    const endUser = permissionsForRoles(['end_user']);
    expect(endUser).not.toContain('comment.worknote.read');
    expect(endUser).not.toContain('comment.worknote.create');
    expect(endUser).not.toContain('audit.read');
    expect(endUser).not.toContain('ticket.read.any');
  });

  it('gives an auditor no mutating permissions', () => {
    for (const permission of ROLE_PERMISSIONS.auditor) {
      expect(permission).not.toMatch(/\.(create|update|manage|assign|resolve|close|delete)/);
    }
  });

  it('merges permissions across multiple roles', () => {
    const merged = permissionsForRoles(['end_user', 'agent']);
    expect(merged).toEqual(expect.arrayContaining([...ROLE_PERMISSIONS.agent]));
  });
});

describe('status transitions', () => {
  it('routes service requests through approval', () => {
    expect(canTransition('service_request', 'new', 'pending_approval')).toBe(true);
    expect(canTransition('incident', 'new', 'pending_approval')).toBe(false);
  });

  it('forbids skipping from new straight to resolved', () => {
    expect(canTransition('incident', 'new', 'resolved')).toBe(false);
  });

  it('treats cancelled as terminal', () => {
    expect(canTransition('incident', 'cancelled', 'in_progress')).toBe(false);
  });
});
