import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import helmet from 'helmet';
import { corsOriginCheck, corsOrigins } from './common/environment';
import { monitoringPrivacy } from './common/monitoring';

let Sentry: any = null;
try {
  Sentry = require('@sentry/node');
} catch {
  // Sentry monitoring is optional
}

const structuredLogger = {
  log(message: unknown, context?: string) {
    writeLog('info', message, context);
  },
  error(message: unknown, trace?: string, context?: string) {
    writeLog('error', message, context, trace);
  },
  warn(message: unknown, context?: string) {
    writeLog('warn', message, context);
  },
  debug(message: unknown, context?: string) {
    writeLog('debug', message, context);
  },
  verbose(message: unknown, context?: string) {
    writeLog('verbose', message, context);
  },
  fatal(message: unknown, context?: string) {
    writeLog('fatal', message, context);
  },
};

function writeLog(level: string, message: unknown, context?: string, trace?: string) {
  process.stdout.write(`${JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: 'pdfforge-api',
    context,
    message: typeof message === 'string' ? message : JSON.stringify(message),
    trace,
  })}\n`);
}

async function bootstrap() {
  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn && Sentry && typeof Sentry.init === 'function') {
    try {
      Sentry.init({
        ...monitoringPrivacy,
        dsn: sentryDsn,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 0.1,
      });
    } catch {
      // Sentry initialization failed gracefully
    }
  }
  // Support BigInt serialization in JSON responses
  (BigInt.prototype as any).toJSON = function () {
    const intVal = Number(this);
    return intVal <= Number.MAX_SAFE_INTEGER ? intVal : this.toString();
  };

  const logger = new Logger('Doxera-APIGateway');
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: structuredLogger,
    cors: {
      origin: corsOriginCheck(corsOrigins(process.env)),
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
    .setTitle('Doxera - Enterprise API')
    .setDescription(
      'PDF processing and document intelligence REST API specifications',
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
    .addTag('System & Health')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 Doxera API Gateway is active on: http://localhost:${port}`);
  logger.log(`📑 OpenAPI Documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap();
