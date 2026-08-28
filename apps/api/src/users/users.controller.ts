import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { Actor } from '@servicedesk/shared';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

class UserSearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Directory lookup for assignment pickers. Staff only; external contacts
   * must never be able to enumerate other users.
   */
  @Get()
  @RequirePermissions('user.read')
  async search(@Query() query: UserSearchDto, @CurrentUser() actor: Actor) {
    const term = query.q?.trim();
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        ...(actor.permissions.includes('user.manage') ? {} : { kind: 'internal' }),
        ...(term
          ? {
              OR: [
                { name: { contains: term, mode: 'insensitive' as const } },
                { email: { contains: term, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, email: true, kind: true, department: true },
      orderBy: { name: 'asc' },
      take: 25,
    });
  }
}
