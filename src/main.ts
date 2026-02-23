import { NestFactory, Reflector } from '@nestjs/core';
import {
  ValidationPipe,
  ClassSerializerInterceptor,
  Logger,
} from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const nodeEnv = configService.get<string>('app.nodeEnv', 'development');
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api/v1');

  // Security
  app.use(helmet.default());
  app.use(compression());

  // CORS
  app.enableCors({
    origin: configService.get<string[]>('app.corsOrigins'),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // API prefix
  app.setGlobalPrefix(apiPrefix);

  // Serve static files (uploaded images)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global interceptors
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(reflector),
    new TransformInterceptor(),
  );

  // Swagger API Documentation
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Nikupangishe API')
      .setDescription(
        `
        ## Nikupangishe - Tanzanian Long-term Rental Platform API

        ### Key concepts:
        - **Owners** register and list houses. All houses are verified and tied to one owner.
        - **Agents** are assigned by owners to manage viewings and tenant coordination.
        - **Tenants** can browse freely. Registration required for chat, viewing requests, and exchanges.
        - **GPS-based** location instead of postcodes — works better in Tanzania.
        - **Exchange system** allows tenants to move or swap houses with owner approval.

        ### Authentication:
        Use Bearer token in Authorization header: \`Authorization: Bearer <token>\`
      `,
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('Authentication', 'Register, login, verify phone')
      .addTag('Houses', 'Browse, list, and manage houses')
      .addTag('Viewings', 'Book and manage house viewings')
      .addTag('Exchanges & Moves', 'Request and manage house moves/exchanges')
      .addTag('Chat', 'Real-time messaging (also via Socket.IO)')
      .addTag('Notifications', 'In-app notifications')
      .setContact(
        'Nikupangishe',
        'https://nikupangishe.co.tz',
        'dev@nikupangishe.co.tz',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });

    logger.log(`📖 Swagger docs: http://localhost:${port}/docs`);
  }

  await app.listen(port);

  logger.log(
    `🚀 Nikupangishe API running on: http://localhost:${port}/${apiPrefix}`,
  );
  logger.log(`🌍 Environment: ${nodeEnv}`);
  logger.log(`🔌 WebSocket (Chat): ws://localhost:${port}/chat`);
}

void bootstrap();
