import type { Request } from 'express';
import type { Actor } from '@servicedesk/shared';

export interface AuthenticatedRequest extends Request {
  actor?: Actor;
  requestId?: string;
}

export function clientIp(request: Request): string | undefined {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim();
  }
  return request.ip;
}

export function userAgent(request: Request): string | undefined {
  const value = request.headers['user-agent'];
  return typeof value === 'string' ? value.slice(0, 500) : undefined;
}
