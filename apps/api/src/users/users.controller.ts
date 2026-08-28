import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { Actor } from '@servicedesk/shared';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { USER_REPOSITORY, type UserRepository } from '../storage/repositories';

class UserSearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  /**
   * Directory lookup for assignment pickers. Staff only; external contacts
   * must never be able to enumerate other users.
   */
  @Get()
  @RequirePermissions('user.read')
  async search(@Query() query: UserSearchDto, @CurrentUser() actor: Actor) {
    const matches = await this.users.search({
      term: query.q?.trim(),
      // Only user administrators may see external contacts in the directory.
      kind: actor.permissions.includes('user.manage') ? undefined : 'internal',
      limit: 25,
    });

    return matches.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      kind: user.kind,
      department: user.department,
    }));
  }
}
