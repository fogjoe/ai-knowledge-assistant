import { Module } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
