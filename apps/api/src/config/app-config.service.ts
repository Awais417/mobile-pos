import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvVars } from './env.validation';

// Ye service NestJS ke ConfigService ko wrap karti hai aur TYPE-SAFE env access deti hai.
// Ab config.get<string>('...') ki jagah hum this.config.jwtAccessSecret likhenge — clean aur safe.
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<EnvVars, true>) {}

  // <EnvVars, true> ka 'true' matlab: values guaranteed hain (validation ho chuki),
  // isliye ye kabhi undefined nahi denge — no null checks needed.

  get databaseUrl(): string {
    return this.config.get('DATABASE_URL', { infer: true });
  }

  get jwtAccessSecret(): string {
    return this.config.get('JWT_ACCESS_SECRET', { infer: true });
  }

  get jwtRefreshSecret(): string {
    return this.config.get('JWT_REFRESH_SECRET', { infer: true });
  }

  get jwtAccessExpiresIn(): string {
    return this.config.get('JWT_ACCESS_EXPIRES_IN', { infer: true });
  }

  get jwtRefreshExpiresIn(): string {
    return this.config.get('JWT_REFRESH_EXPIRES_IN', { infer: true });
  }

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get nodeEnv(): 'development' | 'production' | 'test' {
    return this.config.get('NODE_ENV', { infer: true });
  }

  // Chhote helpers — code aur readable banate hain
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }
}
