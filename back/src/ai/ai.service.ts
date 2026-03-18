import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AiService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async chat(body: any) {
    // 使用项目配置的 LLM 设置
    const apiKey = this.configService.get<string>('LLM_BINDING_API_KEY');
    const host = this.configService.get<string>('LLM_BINDING_HOST');
    const model = this.configService.get<string>('LLM_MODEL');

    // 构建 OpenAI 兼容格式的请求
    const url = `${host}/chat/completions`;

    // 确保请求体包含 model 字段
    const requestBody = {
      ...body,
      model: body.model || model || 'kimi-k2.5',
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, requestBody, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      return response.data;
    } catch (error) {
      // Safe error logging
      const errMsg = error.response?.data || error.message;
      console.error('AI Proxy Error:', errMsg);
      throw new Error('Failed to communicate with AI service');
    }
  }
}
