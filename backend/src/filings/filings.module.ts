import { Module } from '@nestjs/common';
import { FilingsService } from './filings.service';
import { FilingsController } from './filings.controller';

@Module({
  controllers: [FilingsController],
  providers: [FilingsService],
})
export class FilingsModule {}
