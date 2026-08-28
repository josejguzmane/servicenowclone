import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Actor, Permission } from '@servicedesk/shared';
import {
  canReadTicket,
  canTicketAction,
  has,
  ticketScopeFilter,
  type TicketAction,
  type TicketScopeFilter,
  type TicketSubject,
} from './policy';

@Injectable()
export class PolicyService {
  has(actor: Actor, permission: Permission): boolean {
    return has(actor, permission);
  }

  requirePermission(actor: Actor, permission: Permission): void {
    if (!has(actor, permission)) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
  }

  /**
   * Tickets the actor may not read are reported as missing rather than
   * forbidden, so ids of other accounts' tickets cannot be probed.
   */
  assertCanRead(actor: Actor, ticket: TicketSubject): void {
    if (!canReadTicket(actor, ticket).allowed) {
      throw new NotFoundException('Ticket not found');
    }
  }

  assertCan(actor: Actor, action: TicketAction, ticket: TicketSubject): void {
    if (!canReadTicket(actor, ticket).allowed) {
      throw new NotFoundException('Ticket not found');
    }
    const decision = canTicketAction(actor, action, ticket);
    if (!decision.allowed) {
      throw new ForbiddenException(decision.reason ?? `Action not allowed: ${action}`);
    }
  }

  scopeFilter(actor: Actor): TicketScopeFilter {
    return ticketScopeFilter(actor);
  }
}
