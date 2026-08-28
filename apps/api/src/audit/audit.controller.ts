import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RequirePermissions } from '../common/decorators';
import { AUDIT_REPOSITORY, type AuditRepository } from '../storage/repositories';

class AuditQueryDto {
  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}

@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(@Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository) {}

  @Get()
  @RequirePermissions('audit.read')
  async list(@Query() query: AuditQueryDto) {
    return this.audit.list({
      entityType: query.entityType,
      entityId: query.entityId,
      actorId: query.actorId,
      limit: query.limit ?? 50,
      cursor: query.cursor,
    });
  }
}
