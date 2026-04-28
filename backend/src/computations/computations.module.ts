import { Module } from '@nestjs/common';
import { ComputationsService } from './computations.service';
import { ComputationsController } from './computations.controller';

@Module({
  controllers: [ComputationsController],
  providers: [ComputationsService],
})
export class ComputationsModule {}
