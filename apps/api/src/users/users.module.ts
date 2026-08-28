import { Module } from '@nestjs/common';
import { ActorService } from './actor.service';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [ActorService],
  exports: [ActorService],
})
export class UsersModule {}
