import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByEmail(email);
    if (user && (await bcrypt.compare(pass, user.password_hash))) {
      const { password_hash, ...result } = (user as any).toObject
        ? (user as any).toObject()
        : user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    // 更新用户最后活动时间
    await this.usersService.updateLastActive(user._id);

    const payload = {
      email: user.email,
      sub: user._id?.toString() || user._id,
      name: user.name,
      handle: user.handle,
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(createUserDto: any) {
    // Check if user exists
    const existingUser = await this.usersService.findOneByEmail(
      createUserDto.email,
    );
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }
    const existingHandle = await this.usersService.findOneByHandle(
      createUserDto.handle,
    );
    if (existingHandle) {
      throw new ConflictException('Handle already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = await this.usersService.create({
      ...createUserDto,
      password_hash: hashedPassword,
    });

    // Auto login after register
    return this.login(user);
  }
}
