import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

// Health check ka module — TerminusModule (health tools) aur controller jodta hai.
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
