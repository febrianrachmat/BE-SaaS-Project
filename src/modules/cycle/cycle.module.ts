import { Module } from '@nestjs/common';
import { CycleController } from './controllers/cycle.controller';
import { CycleService } from './services/cycle.service';

@Module({
  controllers: [CycleController],
  providers: [CycleService],
  exports: [CycleService],
})
export class CycleModule {}
