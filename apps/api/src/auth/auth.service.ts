import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import type { Actor, SessionResponse } from '@servicedesk/shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActorService } from '../users/actor.service';
import { TokenService } from './token.service';
import type { LoginDto, RegisterDto } from './dto';

export interface AuthContext {
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly actors: ActorService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, context: AuthContext): Promise<SessionResponse> {
    if (!this.config.getOrThrow<boolean>('allowExternalSelfRegistration')) {
      throw new ForbiddenException('Self-registration is disabled; ask your account admin for an invite');
    }

    const email = normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Do not disclose whether the address is already registered.
      throw new BadRequestException('Unable to register with these details');
    }

    const endUserRole = await this.prisma.role.findUnique({ where: { key: 'end_user' } });
    if (!endUserRole) {
      throw new Error('Role "end_user" is missing; run the database seed');
    }

    const account = await this.resolveAccountForDomain(email, dto.company);

    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        kind: 'external',
        customerAccountId: account?.id ?? null,
        passwordHash: await argon2.hash(dto.password, ARGON2_OPTIONS),
        roles: { create: { roleId: endUserRole.id } },
      },
    });

    await this.audit.recordSafely({
      entityType: 'user',
      entityId: user.id,
      actorId: user.id,
      action: 'create',
      source: 'ui',
      requestId: context.requestId,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.buildSession(user.id, user.email, 'external', context);
  }

  async login(dto: LoginDto, context: AuthContext): Promise<SessionResponse> {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always run a verification so timing does not reveal whether the account exists.
    const hash = user?.passwordHash ?? DUMMY_HASH;
    const passwordValid = await argon2.verify(hash, dto.password).catch(() => false);

    if (!user || !user.isActive || !user.passwordHash || !passwordValid) {
      if (user) {
        await this.audit.recordSafely({
          entityType: 'user',
          entityId: user.id,
          actorId: user.id,
          action: 'login_failed',
          source: 'ui',
          requestId: context.requestId,
          ip: context.ip,
          userAgent: context.userAgent,
        });
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.recordSafely({
      entityType: 'user',
      entityId: user.id,
      actorId: user.id,
      action: 'login',
      source: 'ui',
      requestId: context.requestId,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return this.buildSession(user.id, user.email, user.kind, context);
  }

  async refresh(refreshToken: string, context: AuthContext): Promise<SessionResponse> {
    const rotated = await this.tokens.rotate(refreshToken, context);
    const actor = await this.actors.load(rotated.userId);
    return {
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
      expiresIn: rotated.expiresIn,
      user: actor,
    };
  }

  async logout(refreshToken: string, actor: Actor, context: AuthContext): Promise<void> {
    await this.tokens.revoke(refreshToken);
    await this.audit.recordSafely({
      entityType: 'user',
      entityId: actor.userId,
      actorId: actor.userId,
      action: 'logout',
      source: 'ui',
      requestId: context.requestId,
      ip: context.ip,
      userAgent: context.userAgent,
    });
  }

  private async buildSession(
    userId: string,
    email: string,
    kind: 'internal' | 'external',
    context: AuthContext,
  ): Promise<SessionResponse> {
    const tokens = await this.tokens.issue({ sub: userId, email, kind }, context);
    const actor = await this.actors.load(userId);
    return { ...tokens, user: actor };
  }

  /** Links a self-registering contact to the customer account owning their email domain. */
  private async resolveAccountForDomain(email: string, company?: string) {
    const domain = email.split('@')[1];
    if (!domain) return null;
    const existing = await this.prisma.customerAccount.findUnique({ where: { domain } });
    if (existing) return existing.isActive ? existing : null;
    if (!company) return null;
    return this.prisma.customerAccount.create({ data: { name: company.trim(), domain } });
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Pre-computed argon2id hash of a random string, used only for timing equalisation.
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2VydmljZWRlc2tkdW1teQ$0DGtNSXWQ7Ff5S1uzMYyvJ7iH0RS9zjeC2FhKGyR0Bo';
