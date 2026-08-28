import { Injectable, Logger } from '@nestjs/common';
import type { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditContext {
  actorId?: string | null;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  source?: 'ui' | 'api' | 'email' | 'system';
  reason?: string;
}

export interface AuditEntry extends AuditContext {
  entityType: string;
  entityId: string;
  action: AuditAction;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/** Fields never written to the audit trail in clear text. */
const REDACTED_FIELDS = new Set(['passwordHash', 'password', 'tokenHash', 'refreshToken']);

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes audit rows. Pass a transaction client to keep the trail in the same
   * transaction as the mutation it describes.
   */
  async record(entries: AuditEntry | AuditEntry[], tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    const rows = (Array.isArray(entries) ? entries : [entries]).map((entry) => ({
      entityType: entry.entityType,
      entityId: entry.entityId,
      actorId: entry.actorId ?? null,
      action: entry.action,
      field: entry.field ?? null,
      oldValue: serialize(entry.field, entry.oldValue),
      newValue: serialize(entry.field, entry.newValue),
      reason: entry.reason ?? null,
      source: entry.source ?? 'ui',
      requestId: entry.requestId ?? null,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
    }));

    if (rows.length === 0) return;
    await client.auditLog.createMany({ data: rows });
  }

  /**
   * Records one row per changed field. Unchanged fields are skipped so the
   * ticket timeline stays readable.
   */
  async recordDiff(
    entityType: string,
    entityId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    context: AuditContext,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const entries: AuditEntry[] = [];
    for (const [field, newValue] of Object.entries(after)) {
      const oldValue = before[field];
      if (equalish(oldValue, newValue)) continue;
      entries.push({ ...context, entityType, entityId, action: 'update', field, oldValue, newValue });
    }
    await this.record(entries, tx);
  }

  /** Audit failures must never swallow the user-facing operation silently. */
  async recordSafely(entries: AuditEntry | AuditEntry[]): Promise<void> {
    try {
      await this.record(entries);
    } catch (error) {
      this.logger.error(`Failed to write audit entry: ${(error as Error).message}`);
    }
  }
}

function serialize(field: string | undefined, value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (field && REDACTED_FIELDS.has(field)) return '[redacted]';
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value.slice(0, 4000) : JSON.stringify(value).slice(0, 4000);
}

function equalish(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a === null || a === undefined) return b === null || b === undefined;
  return JSON.stringify(a) === JSON.stringify(b);
}
