import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import { LogLevel } from '@nestjs/common';

async function bootstrap() {
  // 根据环境变量设置日志级别
  const logLevel = process.env.LOG_LEVEL || 'info';
  const logLevels: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];
  const allowedLevels = logLevels.slice(0, logLevels.indexOf(logLevel as LogLevel) + 1);

  const app = await NestFactory.create(AppModule, {
    logger: allowedLevels,
  });

  // 增加请求体大小限制
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  app.enableCors();

  // 设置全局 API 前缀
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('TCM Obsidian API')
    .setDescription('The TCM Obsidian backend API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3001);
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`Swagger is running on: ${await app.getUrl()}/docs`);
}
bootstrap();
