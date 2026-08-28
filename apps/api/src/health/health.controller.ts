import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import { DATA_STORE, type DataStore } from '../storage/repositories';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(DATA_STORE) private readonly store: DataStore) {}

  @Public()
  @Get('live')
  live(): { status: string } {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  async ready(): Promise<{ status: string; storage: string; driver: string }> {
    const healthy = await this.store.isHealthy();
    return {
      status: healthy ? 'ok' : 'degraded',
      storage: healthy ? 'up' : 'down',
      driver: this.store.driver,
    };
  }
}
