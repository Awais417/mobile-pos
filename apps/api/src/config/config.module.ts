import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './app-config.service';
import { envSchema } from './env.validation';

// Ye module 2 kaam karta hai:
// 1. ConfigModule ko validation ke saath setup karta hai (boot pe .env check)
// 2. AppConfigService ko global banata hai (har jagah inject ho sake)
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // validate function: boot pe .env ko zod schema se check karta hai.
      // Galat/missing hua to yahin error throw hoga aur app ruk jayegi.
      validate: (config) => envSchema.parse(config),
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
