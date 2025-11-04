// backend/src/documents/documents.controller.ts
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';

@Controller('api/documents') // API 路由前缀: /api/documents
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload') // 路由: POST /api/documents/upload
  @UseInterceptors(FileInterceptor('file')) // 'file' 必须和前端 FormData 的 key 一致
  async uploadFile(
    @UploadedFile(
      // 添加文件验证管道
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 限制 10MB
          // 你还可以添加 FileTypeValidator
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    console.log('Received file:', file.originalname);
    const document = await this.documentsService.uploadAndCreate(file);

    return {
      message: 'File uploaded successfully!',
      document: document,
    };
  }
}
