import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { AppConfig } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  kind: 'internal' | 'external';
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const REFRESH_BYTES = 48;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get settings(): AppConfig['jwt'] {
    return this.config.getOrThrow<AppConfig['jwt']>('jwt');
  }

  async issue(
    payload: AccessTokenPayload,
    context: { ip?: string; userAgent?: string } = {},
  ): Promise<IssuedTokens> {
    const { accessSecret, accessTtl, refreshTtl } = this.settings;

    const accessToken = await this.jwt.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessTtl,
    });

    // Opaque, single-use refresh token: only its hash is stored, so a database
    // read cannot mint sessions.
    const refreshToken = randomBytes(REFRESH_BYTES).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + durationToMs(refreshTtl)),
        ip: context.ip,
        userAgent: context.userAgent,
      },
    });

    return { accessToken, refreshToken, expiresIn: Math.floor(durationToMs(accessTtl) / 1000) };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      return await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.settings.accessSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  /** Rotates a refresh token, revoking the presented one in the same transaction. */
  async rotate(
    refreshToken: string,
    context: { ip?: string; userAgent?: string } = {},
  ): Promise<IssuedTokens & { userId: string }> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || !stored.user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issue(
      { sub: stored.userId, email: stored.user.email, kind: stored.user.kind },
      context,
    );
    return { ...tokens, userId: stored.userId };
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const UNITS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function durationToMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration: ${value}. Expected forms like 15m, 24h, 30d.`);
  }
  const amount = Number(match[1]);
  const unit = UNITS[match[2] as string];
  if (unit === undefined) {
    throw new Error(`Invalid duration unit in: ${value}`);
  }
  return amount * unit;
}
