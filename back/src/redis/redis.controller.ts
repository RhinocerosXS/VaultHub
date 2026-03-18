import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RedisService } from './redis.service';

@ApiTags('Redis')
@Controller('redis')
export class RedisController {
  constructor(private readonly redisService: RedisService) {}

  @Get('health')
  @ApiOperation({ summary: '检查Redis连接状态' })
  async healthCheck() {
    const isConnected = this.redisService.isRedisConnected();
    const pingResult = await this.redisService.ping();

    if (isConnected && pingResult === 'PONG') {
      return {
        status: 'ok',
        message: 'Redis连接正常',
        connected: true,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      status: 'ok',
      message: 'Redis未启用或连接失败，使用内存缓存',
      connected: false,
      pingResult,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('set/:key')
  @ApiOperation({ summary: '设置缓存值' })
  async setValue(
    @Param('key') key: string,
    @Body() body: { value: any; ttl?: number },
  ) {
    await this.redisService.set(key, body.value, body.ttl);
    return {
      success: true,
      message: `Key "${key}" 设置成功`,
    };
  }

  @Get('get/:key')
  @ApiOperation({ summary: '获取缓存值' })
  async getValue(@Param('key') key: string) {
    const value = await this.redisService.get(key);
    return {
      key,
      value,
      exists: value !== undefined,
    };
  }

  @Delete('del/:key')
  @ApiOperation({ summary: '删除缓存值' })
  async deleteValue(@Param('key') key: string) {
    await this.redisService.del(key);
    return {
      success: true,
      message: `Key "${key}" 删除成功`,
    };
  }

  @Post('increment/:key')
  @ApiOperation({ summary: '增加计数器' })
  async increment(
    @Param('key') key: string,
    @Body() body: { amount?: number },
  ) {
    const currentValue = (await this.redisService.get<number>(key)) || 0;
    const newValue = currentValue + (body.amount || 1);
    await this.redisService.set(key, newValue);
    return {
      success: true,
      key,
      value: newValue,
    };
  }

  @Get('exists/:key')
  @ApiOperation({ summary: '检查key是否存在' })
  async exists(@Param('key') key: string) {
    const value = await this.redisService.get(key);
    return {
      key,
      exists: value !== undefined,
    };
  }

  @Delete('clear')
  @ApiOperation({ summary: '清空所有缓存（谨慎使用）' })
  async clearAll() {
    await this.redisService.reset();
    return {
      success: true,
      message: '所有缓存已清空',
    };
  }
}
