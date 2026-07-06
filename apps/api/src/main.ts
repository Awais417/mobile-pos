import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';


async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // HELMET — har response mein security headers lagata hai (XSS, clickjacking se bachav).
  // Sabse pehle lagate hain taake HAR response ismein se guzre.
  app.use(helmet());

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('POS + ERP API')
    .setDescription('SaaS POS + ERP backend — foundation')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const config = app.get(AppConfigService);
  await app.listen(config.port);

  console.log(`API running on http://localhost:${config.port}/api`);
  console.log(`Swagger docs on http://localhost:${config.port}/api/docs`);
}

void bootstrap();
