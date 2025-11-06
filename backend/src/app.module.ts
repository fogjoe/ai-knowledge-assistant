// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config'; // 导入
import { TypeOrmModule } from '@nestjs/typeorm'; // 导入
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DocumentsModule } from './documents/documents.module';
import { IngestionModule } from './ingestion/ingestion.module';

@Module({
  imports: [
    // 1. 全局加载 .env 变量
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // 2. 异步配置 TypeORM
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        // url: configService.get<string>('DATABASE_URL'), // 从 .env 读取
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),

        family: 4, // 👈 强制使用 IPv4 的关键！
        autoLoadEntities: true, // 自动加载所有 Entity
        synchronize: true, // !! 开发模式专用: 自动根据 Entity 同步数据库表结构 (生产环境设为 false)
        ssl: {
          // Supabase 需要 SSL 连接
          rejectUnauthorized: false,
        },
      }),
    }),

    DocumentsModule,

    IngestionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
