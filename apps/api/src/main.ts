import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import helmet from 'helmet';

async function bootstrap() {
  // Support BigInt serialization in JSON responses
  (BigInt.prototype as any).toJSON = function () {
    const intVal = Number(this);
    return intVal <= Number.MAX_SAFE_INTEGER ? intVal : this.toString();
  };

  const logger = new Logger('PDFForge-APIGateway');
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key', 'Accept'],
    },
  });

  // Enterprise Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Global Exception & Validation Filters
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // OpenAPI / Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('PDFForge AI - Enterprise API')
    .setDescription(
      'Cloud-scale PDF processing and document intelligence REST & GraphQL API specifications',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'X-API-Key')
    .addTag('Authentication')
    .addTag('Files & Storage')
    .addTag('PDF Processing Engine')
    .addTag('AI Document Intelligence')
    .addTag('Billing & Subscriptions')
    .addTag('Organizations & Workspaces')
    .addTag('Admin & Observability')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 PDFForge AI API Gateway is active on: http://localhost:${port}`);
  logger.log(`📑 OpenAPI Documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap();
