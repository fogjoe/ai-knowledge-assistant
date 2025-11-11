import { Controller, Post, Body, ValidationPipe } from '@nestjs/common';
import { ChatService, RagResponse } from './chat.service';
import { ChatQueryDto } from './dto/chat.dto';

@Controller('api/chat') // API 路由前缀: /api/chat
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async handleChatQuery(
    @Body(new ValidationPipe()) body: ChatQueryDto,
  ): Promise<RagResponse> {
    // 调用 RAG 核心服务
    return this.chatService.generateResponse(body.query);
  }
}
