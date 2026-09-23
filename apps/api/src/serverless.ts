import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as express from 'express';
import serverlessHttp from 'serverless-http';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// Cache the handler so the NestJS app is only initialised once per cold start
let cachedHandler: ReturnType<typeof serverlessHttp> | null = null;

async function buildHandler() {
  const expressApp = express();

  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { logger: ['error', 'warn'] },
  );

  app.use(helmet());
  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();

  return serverlessHttp(expressApp);
}

export const handler = async (event: any, context: any) => {
  if (!cachedHandler) {
    cachedHandler = await buildHandler();
  }
  return cachedHandler(event, context);
};
