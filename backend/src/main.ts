// backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common'; // 导入

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. 启用 CORS
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://[::1]:3000',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // ✅ if your frontend uses cookies or auth headers
  });

  // 2. (推荐) 启用全局验证管道
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // 3. 修改端口为 5050
  await app.listen(5050, '127.0.0.1');
  console.log(`Application is running on: ${await app.getUrl()}`);
}
// The correct way: call bootstrap and catch any errors
bootstrap().catch((err) => {
  console.error('Application failed to start', err);
  process.exit(1); // Exit with a failure code
});
