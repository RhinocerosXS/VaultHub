import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AiService } from './ai.service';
import { AuthGuard } from '@nestjs/passport';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // AI chat 接口支持游客访问，用于 AI 一键研读功能
  @UseGuards(OptionalJwtAuthGuard)
  @Post('chat')
  chat(@Body() body: any, @Req() req: any) {
    return this.aiService.chat(body);
  }
}
