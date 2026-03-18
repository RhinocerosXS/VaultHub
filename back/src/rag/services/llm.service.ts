import { Injectable, Logger } from '@nestjs/common';

export interface LLMConfig {
  binding: 'openai' | 'gemini' | 'azure' | 'local';
  apiKey: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  private config: LLMConfig;

  constructor() {
    this.config = this.loadConfig();
    this.logger.log(
      `LLM binding: ${this.config.binding}, model: ${this.config.model}`,
    );
  }

  /**
   * 加载配置
   */
  private loadConfig(): LLMConfig {
    const binding = (process.env.LLM_BINDING ||
      'openai') as LLMConfig['binding'];

    switch (binding) {
      case 'openai':
        return {
          binding: 'openai',
          apiKey:
            process.env.LLM_BINDING_API_KEY || process.env.OPENAI_API_KEY || '',
          baseUrl: process.env.LLM_BINDING_HOST,
          model: process.env.LLM_MODEL || 'gpt-4o-mini',
        };

      case 'gemini':
        return {
          binding: 'gemini',
          apiKey: process.env.GEMINI_API_KEY || '',
          model:
            process.env.LLM_MODEL ||
            process.env.GEMINI_MODEL ||
            'gemini-1.5-flash',
        };

      case 'azure':
        return {
          binding: 'azure',
          apiKey: process.env.AZURE_OPENAI_API_KEY || '',
          baseUrl: process.env.AZURE_OPENAI_ENDPOINT || '',
          model: process.env.LLM_MODEL || 'gpt-4o-mini',
        };

      case 'local':
        return {
          binding: 'local',
          apiKey: '',
          baseUrl: process.env.LOCAL_LLM_URL || 'http://localhost:11434',
          model: process.env.LLM_MODEL || 'llama3.1',
        };

      default:
        throw new Error(`Unknown LLM binding: ${binding}`);
    }
  }

  /**
   * 发送聊天请求（使用默认配置）
   */
  async chat(messages: ChatMessage[]): Promise<LLMResponse> {
    return this.chatWithConfig(messages, this.config);
  }

  /**
   * 发送聊天请求（使用自定义配置）
   */
  async chatWithConfig(
    messages: ChatMessage[],
    config: LLMConfig,
  ): Promise<LLMResponse> {
    this.logger.debug(
      `Using custom LLM config: ${config.binding}, model: ${config.model}`,
    );

    switch (config.binding) {
      case 'openai':
        return this.openAIChatWithConfig(messages, config);
      case 'gemini':
        return this.geminiChatWithConfig(messages, config);
      case 'azure':
        return this.azureChatWithConfig(messages, config);
      case 'local':
        return this.localChatWithConfig(messages, config);
      default:
        throw new Error(`Unsupported LLM binding: ${config.binding}`);
    }
  }

  /**
   * OpenAI 格式聊天
   */
  private async openAIChat(messages: ChatMessage[]): Promise<LLMResponse> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage,
    };
  }

  /**
   * Gemini 聊天
   */
  private async geminiChat(messages: ChatMessage[]): Promise<LLMResponse> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    // 转换消息格式
    const contents = messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();

    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    };
  }

  /**
   * Azure OpenAI 聊天
   */
  private async azureChat(messages: ChatMessage[]): Promise<LLMResponse> {
    const apiKey = this.config.apiKey;
    const baseUrl = this.config.baseUrl;

    if (!apiKey || !baseUrl) {
      throw new Error('Azure OpenAI API key or endpoint not configured');
    }

    const response = await fetch(
      `${baseUrl}/openai/deployments/${this.config.model}/chat/completions?api-version=2024-02-01`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          messages,
          temperature: 0.7,
          max_tokens: 2048,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Azure OpenAI API error: ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage,
    };
  }

  /**
   * 本地模型聊天 (Ollama)
   */
  private async localChat(messages: ChatMessage[]): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl;

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: false,
        options: {
          temperature: 0.7,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Local LLM API error: ${error}`);
    }

    const data = await response.json();

    return {
      content: data.message?.content || '',
    };
  }

  /**
   * OpenAI 格式聊天（使用自定义配置）
   */
  private async openAIChatWithConfig(
    messages: ChatMessage[],
    config: LLMConfig,
  ): Promise<LLMResponse> {
    const apiKey = config.apiKey;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const baseUrl = config.baseUrl || 'https://api.openai.com/v1';

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage,
    };
  }

  /**
   * Gemini 聊天（使用自定义配置）
   */
  private async geminiChatWithConfig(
    messages: ChatMessage[],
    config: LLMConfig,
  ): Promise<LLMResponse> {
    const apiKey = config.apiKey;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    // 转换消息格式
    const contents = messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();

    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    };
  }

  /**
   * Azure OpenAI 聊天（使用自定义配置）
   */
  private async azureChatWithConfig(
    messages: ChatMessage[],
    config: LLMConfig,
  ): Promise<LLMResponse> {
    const apiKey = config.apiKey;
    const baseUrl = config.baseUrl;

    if (!apiKey || !baseUrl) {
      throw new Error('Azure OpenAI API key or endpoint not configured');
    }

    const response = await fetch(
      `${baseUrl}/openai/deployments/${config.model}/chat/completions?api-version=2024-02-01`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          messages,
          temperature: 0.7,
          max_tokens: 2048,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Azure OpenAI API error: ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage,
    };
  }

  /**
   * 本地模型聊天 (Ollama)（使用自定义配置）
   */
  private async localChatWithConfig(
    messages: ChatMessage[],
    config: LLMConfig,
  ): Promise<LLMResponse> {
    const baseUrl = config.baseUrl;

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: false,
        options: {
          temperature: 0.7,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Local LLM API error: ${error}`);
    }

    const data = await response.json();

    return {
      content: data.message?.content || '',
    };
  }

  /**
   * 流式聊天
   */
  async *chatStream(
    messages: ChatMessage[],
  ): AsyncGenerator<string, void, unknown> {
    // 简化实现，实际应该根据 binding 类型分别处理
    const response = await this.chat(messages);
    yield response.content;
  }

  /**
   * 获取配置
   */
  getConfig(): LLMConfig {
    return { ...this.config };
  }
}
