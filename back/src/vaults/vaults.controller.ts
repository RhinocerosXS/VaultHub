import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Inject,
} from '@nestjs/common';
import { VaultsService } from './vaults.service';
import { PGVaultsService } from './services/pg-vaults.service';
import { AuthGuard } from '@nestjs/passport';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { UsersService } from '../users/users.service';

interface RequestWithUser {
  user: AuthenticatedUser;
}

// 使用 PostgreSQL 存储的配置
const USE_POSTGRES_STORAGE = process.env.USE_POSTGRES_STORAGE === 'true';

@Controller('vaults')
export class VaultsController {
  constructor(
    private readonly vaultsService: VaultsService,
    private readonly pgVaultsService: PGVaultsService,
    private readonly usersService: UsersService,
  ) {}

  private getService() {
    return USE_POSTGRES_STORAGE ? this.pgVaultsService : this.vaultsService;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(
    @Body() createVaultDto: unknown,
    @Request() req: RequestWithUser,
  ) {
    console.log('VaultsController.create - Received request:', createVaultDto);
    console.log(
      'VaultsController.create - is_linked:',
      (createVaultDto as any).is_linked,
    );

    if (USE_POSTGRES_STORAGE) {
      // 获取用户信息
      const user = await this.usersService.findOneById(req.user.userId);
      if (!user) {
        throw new Error('User not found');
      }
      return this.pgVaultsService.create(
        createVaultDto,
        req.user.userId,
        user.handle,
      );
    }
    return this.vaultsService.create(createVaultDto, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  findAll(@Request() req: RequestWithUser) {
    return this.getService().findAllByUser(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.getService().findOne(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateVaultDto: unknown,
    @Request() req: RequestWithUser,
  ) {
    return this.getService().update(id, updateVaultDto, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.getService().remove(id, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/collaborators')
  addCollaborator(
    @Param('id') id: string,
    @Body('handle') handle: string,
    @Request() req: RequestWithUser,
  ) {
    console.log('VaultsController.addCollaborator - Received request:', {
      id,
      handle,
      userId: req.user.userId,
    });
    return this.getService().addCollaborator(id, handle, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id/collaborators/:handle')
  removeCollaborator(
    @Param('id') id: string,
    @Param('handle') handle: string,
    @Request() req: RequestWithUser,
  ) {
    return this.getService().removeCollaborator(id, handle, req.user.userId);
  }
}
