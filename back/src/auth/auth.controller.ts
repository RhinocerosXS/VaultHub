import {
  Controller,
  Request,
  Post,
  UseGuards,
  Get,
  Body,
  Param,
  Patch,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import type { AuthenticatedUser } from './jwt.strategy';

interface RequestWithUser {
  user: AuthenticatedUser;
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Request() req: RequestWithUser) {
    return this.authService.login(req.user);
  }

  @Post('register')
  async register(@Body() createUserDto: unknown) {
    return this.authService.register(createUserDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getProfile(@Request() req: RequestWithUser) {
    // 从数据库获取最新的用户信息（包括 bio）
    const user = await this.usersService.findOneById(req.user.userId);
    return {
      userId: req.user.userId,
      email: req.user.email,
      name: user?.name || req.user.name,
      handle: user?.handle || req.user.handle,
      bio: user?.bio || '',
    };
  }

  // 获取指定用户的信息（通过 handle，公开接口）
  @Get('user/:handle')
  async getUserByHandle(@Param('handle') handle: string) {
    const user = await this.usersService.findOneByHandle(handle);
    if (!user) {
      return { error: 'User not found' };
    }
    // 只返回公开信息
    return {
      _id: user._id,
      name: user.name,
      handle: user.handle,
      bio: user.bio || '',
    };
  }

  // 获取指定用户的信息（通过 userId，需要登录）
  @UseGuards(AuthGuard('jwt'))
  @Get('user/id/:userId')
  async getUserById(@Param('userId') userId: string) {
    const user = await this.usersService.findOneById(userId);
    if (!user) {
      return { error: 'User not found' };
    }
    // 只返回公开信息
    return {
      _id: user._id,
      name: user.name,
      handle: user.handle,
      bio: user.bio || '',
    };
  }

  // 更新当前用户的个人资料
  @UseGuards(AuthGuard('jwt'))
  @Patch('profile')
  async updateProfile(
    @Request() req: RequestWithUser,
    @Body() updateData: { name?: string; bio?: string },
  ) {
    const userId = req.user.userId;
    const updatedUser = await this.usersService.update(userId, updateData);
    if (!updatedUser) {
      return { error: 'User not found' };
    }
    return {
      name: updatedUser.name,
      bio: updatedUser.bio || '',
    };
  }
}
