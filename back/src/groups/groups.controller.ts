import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  // 创建社群
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() data: any, @Request() req) {
    const userId = req.user.userId || req.user._id;
    const userName = req.user.name;
    return this.groupsService.create(data, userId, userName);
  }

  // 获取所有社群
  @Get()
  async findAll(@Query() query: any) {
    return this.groupsService.findAll(query);
  }

  // 获取热门社群
  @Get('hot')
  async findHot(@Query('limit') limit: string) {
    return this.groupsService.findHot(limit ? parseInt(limit) : 10);
  }

  // 获取推荐社群
  @Get('recommended')
  async findRecommended(@Request() req) {
    const userId = req.user?.userId || req.user?._id;
    return this.groupsService.findRecommended(userId);
  }

  // 获取我加入的社群
  @Get('my-groups')
  @UseGuards(JwtAuthGuard)
  async findMyGroups(@Request() req) {
    const userId = req.user.userId || req.user._id;
    return this.groupsService.findMyGroups(userId);
  }

  // 获取我创建的社群
  @Get('created-by-me')
  @UseGuards(JwtAuthGuard)
  async findCreatedByMe(@Request() req) {
    const userId = req.user.userId || req.user._id;
    return this.groupsService.findCreatedByMe(userId);
  }

  // 搜索社群
  @Get('search')
  async search(@Query('keyword') keyword: string) {
    return this.groupsService.search(keyword);
  }

  // 获取社群详情
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.groupsService.findById(id);
  }

  // 更新社群
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() data: any, @Request() req) {
    const userId = req.user.userId || req.user._id;
    return this.groupsService.update(id, data, userId);
  }

  // 删除社群
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string, @Request() req) {
    const userId = req.user.userId || req.user._id;
    return this.groupsService.delete(id, userId);
  }

  // 加入社群
  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  async join(@Param('id') id: string, @Request() req) {
    const userId = req.user.userId || req.user._id;
    return this.groupsService.join(id, userId);
  }

  // 退出社群
  @Post(':id/leave')
  @UseGuards(JwtAuthGuard)
  async leave(@Param('id') id: string, @Request() req) {
    const userId = req.user.userId || req.user._id;
    return this.groupsService.leave(id, userId);
  }

  // 检查是否已加入
  @Get(':id/is-member')
  @UseGuards(JwtAuthGuard)
  async isMember(@Param('id') id: string, @Request() req) {
    const userId = req.user.userId || req.user._id;
    const isMember = await this.groupsService.isMember(id, userId);
    return { isMember };
  }

  // 获取社群成员列表
  @Get(':id/members')
  @UseGuards(JwtAuthGuard)
  async getGroupMembers(@Param('id') id: string) {
    return this.groupsService.getGroupMembers(id);
  }

  // ==================== 群组消息相关 API ====================

  // 获取群组消息列表
  @Get(':id/messages')
  @UseGuards(JwtAuthGuard)
  async getGroupMessages(
    @Param('id') id: string,
    @Query('limit') limit: string,
    @Query('before') before: string,
  ) {
    return this.groupsService.getGroupMessages(
      id,
      limit ? parseInt(limit) : 50,
      before,
    );
  }

  // 发送群组消息
  @Post(':id/messages')
  @UseGuards(JwtAuthGuard)
  async sendGroupMessage(
    @Param('id') id: string,
    @Body() data: { content: string; message_type?: string; reply_to?: string },
    @Request() req,
  ) {
    const userId = req.user.userId || req.user._id;
    const userName = req.user.name || '未知用户';
    return this.groupsService.sendGroupMessage(
      id,
      userId,
      userName,
      data.content,
      data.message_type || 'text',
      data.reply_to,
    );
  }

  // 删除/撤回群组消息
  @Delete(':id/messages/:messageId')
  @UseGuards(JwtAuthGuard)
  async deleteGroupMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Request() req,
  ) {
    const userId = req.user.userId || req.user._id;
    return this.groupsService.deleteGroupMessage(id, messageId, userId);
  }

  // ==================== 加入申请相关 API ====================

  // 提交加入申请
  @Post(':id/join-requests')
  @UseGuards(JwtAuthGuard)
  async submitJoinRequest(
    @Param('id') id: string,
    @Body() data: { message: string },
    @Request() req,
  ) {
    const userId = req.user.userId || req.user._id;
    const userName = req.user.name || '未知用户';
    const userHandle = req.user.handle || '';
    return this.groupsService.submitJoinRequest(
      id,
      userId,
      userName,
      userHandle,
      data.message,
    );
  }

  // 获取社群的加入申请列表（管理员/创建者用）
  @Get(':id/join-requests')
  @UseGuards(JwtAuthGuard)
  async getGroupJoinRequests(@Param('id') id: string, @Request() req) {
    const userId = req.user.userId || req.user._id;
    return this.groupsService.getGroupJoinRequests(id, userId);
  }

  // 获取我的加入申请列表
  @Get('my-join-requests')
  @UseGuards(JwtAuthGuard)
  async getMyJoinRequests(@Request() req) {
    const userId = req.user.userId || req.user._id;
    return this.groupsService.getMyJoinRequests(userId);
  }

  // 处理加入申请（通过或拒绝）
  @Post('join-requests/:requestId/process')
  @UseGuards(JwtAuthGuard)
  async processJoinRequest(
    @Param('requestId') requestId: string,
    @Body() data: { approve: boolean; rejectReason?: string },
    @Request() req,
  ) {
    const userId = req.user.userId || req.user._id;
    return this.groupsService.processJoinRequest(
      requestId,
      userId,
      data.approve,
      data.rejectReason,
    );
  }

  // 取消我的加入申请
  @Delete('join-requests/:requestId')
  @UseGuards(JwtAuthGuard)
  async cancelJoinRequest(
    @Param('requestId') requestId: string,
    @Request() req,
  ) {
    const userId = req.user.userId || req.user._id;
    return this.groupsService.cancelJoinRequest(requestId, userId);
  }

  // 获取待处理申请数量
  @Get(':id/join-requests/pending-count')
  @UseGuards(JwtAuthGuard)
  async getPendingJoinRequestCount(@Param('id') id: string, @Request() req) {
    const userId = req.user.userId || req.user._id;
    const count = await this.groupsService.getPendingJoinRequestCount(
      id,
      userId,
    );
    return { count };
  }

  // ==================== 邀请相关 API ====================

  // 创建邀请
  @Post(':id/invites')
  @UseGuards(JwtAuthGuard)
  async createInvite(
    @Param('id') id: string,
    @Body() data: { invitee_handle: string },
    @Request() req,
  ) {
    const userId = req.user.userId || req.user._id;
    const userName = req.user.name || '未知用户';
    return this.groupsService.createInvite(
      id,
      userId,
      userName,
      data.invitee_handle,
    );
  }

  // 获取社群邀请列表
  @Get(':id/invites')
  @UseGuards(JwtAuthGuard)
  async getGroupInvites(@Param('id') id: string, @Request() req) {
    const userId = req.user.userId || req.user._id;
    return this.groupsService.getGroupInvites(id, userId);
  }

  // 获取我的邀请列表
  @Get('invites/my')
  @UseGuards(JwtAuthGuard)
  async getMyInvites(@Request() req) {
    const userId = req.user.userId || req.user._id;
    return this.groupsService.getMyInvites(userId);
  }

  // 接受邀请
  @Post('invites/:inviteId/accept')
  @UseGuards(JwtAuthGuard)
  async acceptInvite(@Param('inviteId') inviteId: string, @Request() req) {
    const userId = req.user.userId || req.user._id;
    return this.groupsService.acceptInvite(inviteId, userId);
  }

  // 拒绝邀请
  @Post('invites/:inviteId/reject')
  @UseGuards(JwtAuthGuard)
  async rejectInvite(@Param('inviteId') inviteId: string, @Request() req) {
    const userId = req.user.userId || req.user._id;
    return this.groupsService.rejectInvite(inviteId, userId);
  }

  // 取消邀请
  @Delete('invites/:inviteId')
  @UseGuards(JwtAuthGuard)
  async cancelInvite(@Param('inviteId') inviteId: string, @Request() req) {
    const userId = req.user.userId || req.user._id;
    return this.groupsService.cancelInvite(inviteId, userId);
  }

  // ==================== 成员管理相关 API ====================

  // 踢出成员
  @Delete(':id/members/:memberId')
  @UseGuards(JwtAuthGuard)
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Request() req,
  ) {
    const userId = req.user.userId || req.user._id;
    return this.groupsService.removeMember(id, memberId, userId);
  }
}
