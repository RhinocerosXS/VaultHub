import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Group, GroupDocument, GroupVisibility } from './schemas/group.schema';
import {
  GroupMessage,
  GroupMessageDocument,
} from './schemas/group-message.schema';
import {
  GroupJoinRequest,
  GroupJoinRequestDocument,
  JoinRequestStatus,
} from './schemas/group-join-request.schema';
import {
  GroupInvite,
  GroupInviteDocument,
  InviteStatus,
} from './schemas/group-invite.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from '../interactions/schemas/notification.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(Group.name)
    private groupModel: Model<GroupDocument>,
    @InjectModel(GroupMessage.name)
    private groupMessageModel: Model<GroupMessageDocument>,
    @InjectModel(GroupJoinRequest.name)
    private groupJoinRequestModel: Model<GroupJoinRequestDocument>,
    @InjectModel(GroupInvite.name)
    private groupInviteModel: Model<GroupInviteDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  // 检查用户是否已创建过社群
  async hasUserCreatedGroup(userId: string): Promise<boolean> {
    const count = await this.groupModel.countDocuments({
      creator_id: userId,
    });
    return count > 0;
  }

  // 创建社群
  async create(data: any, userId: string, userName?: string): Promise<Group> {
    console.log(
      'GroupsService.create - userId:',
      userId,
      'userName:',
      userName,
      'data:',
      data,
    );

    // 检查用户是否已创建过社群
    const hasCreated = await this.hasUserCreatedGroup(userId);
    if (hasCreated) {
      throw new BadRequestException(
        '您已经创建过一个社群，每个用户只能创建一个社群',
      );
    }

    const groupId = uuidv4();

    const groupData = {
      ...data,
      id: groupId,
      creator_id: userId,
      creator_name: userName || '未知用户',
      members: [userId],
      admins: [userId],
      member_count: 1,
    };

    const group = new this.groupModel(groupData);
    const saved = await group.save();
    return saved;
  }

  // 获取所有社群
  async findAll(query: any = {}): Promise<Group[]> {
    return this.groupModel
      .find(query)
      .sort({ is_official: -1, member_count: -1, createdAt: -1 })
      .exec();
  }

  // 获取热门社群
  async findHot(limit: number = 10): Promise<Group[]> {
    return this.groupModel
      .find({ visibility: GroupVisibility.PUBLIC })
      .sort({ member_count: -1, post_count: -1 })
      .limit(limit)
      .exec();
  }

  // 获取推荐社群
  async findRecommended(userId?: string, limit: number = 10): Promise<Group[]> {
    const query: any = { visibility: GroupVisibility.PUBLIC };

    // 如果提供了用户ID，排除已加入的社群
    if (userId) {
      query.members = { $nin: [userId] };
    }

    return this.groupModel
      .find(query)
      .sort({ is_official: -1, member_count: -1 })
      .limit(limit)
      .exec();
  }

  // 获取我加入的社群
  async findMyGroups(userId: string): Promise<Group[]> {
    return this.groupModel
      .find({ members: userId })
      .sort({ updatedAt: -1 })
      .exec();
  }

  // 获取我创建的社群
  async findCreatedByMe(userId: string): Promise<Group[]> {
    return this.groupModel
      .find({ creator_id: userId })
      .sort({ createdAt: -1 })
      .exec();
  }

  // 获取社群详情
  async findById(id: string): Promise<Group> {
    const group = await this.groupModel.findOne({ id }).exec();
    if (!group) {
      throw new NotFoundException('社群不存在');
    }
    return group;
  }

  // 更新社群
  async update(id: string, data: any, userId: string): Promise<Group> {
    const group = await this.findById(id);

    // 检查权限（创建者或管理员可以更新）
    const isAdmin = group.admins.some((adminId) => adminId === userId);
    const isCreator = group.creator_id === userId;

    if (!isAdmin && !isCreator) {
      throw new BadRequestException('您没有权限更新此社群');
    }

    const updated = await this.groupModel
      .findOneAndUpdate({ id }, data, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException('社群不存在');
    }

    return updated;
  }

  // 删除社群
  async delete(
    id: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const group = await this.findById(id);

    // 只有创建者可以删除
    if (group.creator_id !== userId) {
      throw new BadRequestException('您没有权限删除此社群');
    }

    // 删除社群的所有消息
    await this.groupMessageModel.deleteMany({ group_id: id }).exec();

    // 删除社群的所有加入申请
    await this.groupJoinRequestModel.deleteMany({ group_id: id }).exec();

    const result = await this.groupModel.deleteOne({ id }).exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('社群不存在');
    }

    return { success: true, message: '社群删除成功' };
  }

  // 加入社群（公开社群直接加入，私密社群或需要审核的社群需要申请）
  async join(id: string, userId: string): Promise<Group> {
    const group = await this.findById(id);

    // 检查是否已经是成员
    if (group.members.some((memberId) => memberId === userId)) {
      throw new BadRequestException('您已经是该社群的成员');
    }

    // 私密社群需要申请，不能直接进入
    if (group.visibility === GroupVisibility.PRIVATE) {
      throw new BadRequestException('私密社群需要申请加入');
    }

    // 需要审核的公开社群也需要申请
    if (group.require_approval) {
      throw new BadRequestException('该社群需要管理员审核才能加入');
    }

    // 公开且不需要审核的社群直接加入
    group.members.push(userId);
    group.member_count = group.members.length;

    await group.save();
    return group;
  }

  // 退出社群
  async leave(id: string, userId: string): Promise<Group> {
    const group = await this.findById(id);

    // 检查是否是成员
    if (!group.members.some((memberId) => memberId === userId)) {
      throw new BadRequestException('您不是该社群的成员');
    }

    // 创建者不能退出
    if (group.creator_id === userId) {
      throw new BadRequestException('创建者不能退出社群，请转让或删除社群');
    }

    // 移除成员
    group.members = group.members.filter((memberId) => memberId !== userId);
    group.admins = group.admins.filter((adminId) => adminId !== userId);
    group.member_count = group.members.length;

    await group.save();
    return group;
  }

  // 检查用户是否已加入社群
  async isMember(id: string, userId: string): Promise<boolean> {
    const group = await this.findById(id);
    return group.members.some((memberId) => memberId === userId);
  }

  // 获取社群成员列表
  async getGroupMembers(
    id: string,
  ): Promise<{ members: any[]; admins: any[]; creator: any }> {
    const group = await this.findById(id);

    // 获取所有成员的用户信息
    const memberIds = group.members;
    const users = await this.userModel
      .find({ _id: { $in: memberIds } })
      .select('_id name handle avatar_url')
      .exec();

    // 创建用户ID到用户信息的映射
    const userMap = new Map();
    users.forEach((user) => {
      userMap.set(user._id.toString(), {
        id: user._id.toString(),
        name: user.name,
        handle: user.handle,
        avatar_url: user.avatar_url,
      });
    });

    // 构建成员列表
    const members = group.members.map((memberId) => {
      const userInfo = userMap.get(memberId) || {
        id: memberId,
        name: '未知用户',
        handle: '',
        avatar_url: '',
      };
      return {
        ...userInfo,
        isAdmin: group.admins.includes(memberId),
        isCreator: group.creator_id === memberId,
      };
    });

    // 构建管理员列表
    const admins = group.admins.map((adminId) => {
      const userInfo = userMap.get(adminId) || {
        id: adminId,
        name: '未知用户',
        handle: '',
        avatar_url: '',
      };
      return {
        ...userInfo,
        isCreator: group.creator_id === adminId,
      };
    });

    // 获取创建者信息
    const creatorInfo = userMap.get(group.creator_id) || {
      id: group.creator_id,
      name: group.creator_name || '创建者',
      handle: '',
      avatar_url: '',
    };
    const creator = {
      ...creatorInfo,
      isCreator: true,
    };

    return { members, admins, creator };
  }

  // 搜索社群
  async search(keyword: string): Promise<Group[]> {
    return this.groupModel
      .find({
        visibility: GroupVisibility.PUBLIC,
        $or: [
          { name: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } },
          { tags: { $in: [new RegExp(keyword, 'i')] } },
        ],
      })
      .sort({ member_count: -1 })
      .exec();
  }

  // 增加帖子计数
  async incrementPostCount(id: string): Promise<Group> {
    const updated = await this.groupModel
      .findOneAndUpdate({ id }, { $inc: { post_count: 1 } }, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException('社群不存在');
    }

    return updated;
  }

  // ==================== 群组消息相关方法 ====================

  // 获取群组消息列表
  async getGroupMessages(
    groupId: string,
    limit: number = 50,
    before?: string,
  ): Promise<GroupMessage[]> {
    // 检查群组是否存在
    await this.findById(groupId);

    const query: any = { group_id: groupId };

    // 如果提供了 before 参数，获取更早的消息
    if (before) {
      const beforeMessage = await this.groupMessageModel
        .findOne({ id: before })
        .exec();
      if (beforeMessage) {
        query.createdAt = { $lt: beforeMessage.createdAt };
      }
    }

    return this.groupMessageModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  // 发送群组消息
  async sendGroupMessage(
    groupId: string,
    senderId: string,
    senderName: string,
    content: string,
    messageType: string = 'text',
    replyTo?: string,
  ): Promise<GroupMessage> {
    // 检查群组是否存在
    const group = await this.findById(groupId);

    // 检查用户是否是群组成员
    if (!group.members.some((memberId) => memberId === senderId)) {
      throw new BadRequestException('您不是该社群的成员，无法发送消息');
    }

    const messageId = uuidv4();

    const messageData = {
      id: messageId,
      group_id: groupId,
      sender_id: senderId,
      sender_name: senderName,
      content,
      message_type: messageType,
      reply_to: replyTo || null,
    };

    const message = new this.groupMessageModel(messageData);
    const saved = await message.save();

    // 更新群组的更新时间
    await this.groupModel
      .findOneAndUpdate(
        { id: groupId },
        { updatedAt: new Date() },
        { new: true },
      )
      .exec();

    return saved;
  }

  // 删除/撤回群组消息
  async deleteGroupMessage(
    groupId: string,
    messageId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const message = await this.groupMessageModel
      .findOne({ id: messageId })
      .exec();

    if (!message) {
      throw new NotFoundException('消息不存在');
    }

    // 获取群组信息检查权限
    const group = await this.findById(groupId);
    const isAdmin = group.admins.includes(userId);
    const isSender = message.sender_id === userId;

    // 检查权限（发送者或管理员可以撤回消息）
    if (!isSender && !isAdmin) {
      throw new BadRequestException('您没有权限删除此消息');
    }

    // 软删除：标记消息为已删除
    message.is_deleted = true;
    message.deleted_by = userId;
    message.deleted_at = new Date();
    message.content =
      isAdmin && !isSender ? '该消息已被管理员撤回' : '该消息已被撤回';
    await message.save();

    return { success: true, message: '消息撤回成功' };
  }

  // ==================== 加入申请相关方法 ====================

  // 提交加入申请
  async submitJoinRequest(
    groupId: string,
    userId: string,
    userName: string,
    userHandle: string,
    message: string,
  ): Promise<GroupJoinRequest> {
    // 检查群组是否存在
    const group = await this.findById(groupId);

    // 检查是否已经是成员
    if (group.members.some((memberId) => memberId === userId)) {
      throw new BadRequestException('您已经是该社群的成员');
    }

    // 检查是否已有待处理的申请
    const existingRequest = await this.groupJoinRequestModel
      .findOne({
        group_id: groupId,
        user_id: userId,
        status: JoinRequestStatus.PENDING,
      })
      .exec();

    if (existingRequest) {
      throw new BadRequestException('您已经提交过加入申请，请等待管理员审核');
    }

    const requestId = uuidv4();

    const requestData = {
      id: requestId,
      group_id: groupId,
      user_id: userId,
      user_name: userName,
      user_handle: userHandle,
      message,
      status: JoinRequestStatus.PENDING,
    };

    const request = new this.groupJoinRequestModel(requestData);
    const saved = await request.save();

    return saved;
  }

  // 获取社群的待处理申请列表（管理员/创建者用）
  async getGroupJoinRequests(
    groupId: string,
    userId: string,
  ): Promise<GroupJoinRequest[]> {
    // 检查群组是否存在
    const group = await this.findById(groupId);

    // 检查权限（只有创建者或管理员可以查看申请）
    const isAdmin = group.admins.some((adminId) => adminId === userId);
    const isCreator = group.creator_id === userId;

    if (!isAdmin && !isCreator) {
      throw new BadRequestException('您没有权限查看此社群的加入申请');
    }

    return this.groupJoinRequestModel
      .find({ group_id: groupId, status: JoinRequestStatus.PENDING })
      .sort({ createdAt: -1 })
      .exec();
  }

  // 获取我的加入申请列表
  async getMyJoinRequests(userId: string): Promise<GroupJoinRequest[]> {
    return this.groupJoinRequestModel
      .find({ user_id: userId })
      .sort({ createdAt: -1 })
      .exec();
  }

  // 处理加入申请（通过或拒绝）
  async processJoinRequest(
    requestId: string,
    userId: string,
    approve: boolean,
    rejectReason?: string,
  ): Promise<{ success: boolean; message: string }> {
    const request = await this.groupJoinRequestModel
      .findOne({ id: requestId })
      .exec();

    if (!request) {
      throw new NotFoundException('申请不存在');
    }

    // 检查群组是否存在
    const group = await this.findById(request.group_id);

    // 检查权限（只有创建者或管理员可以处理申请）
    const isAdmin = group.admins.some((adminId) => adminId === userId);
    const isCreator = group.creator_id === userId;

    if (!isAdmin && !isCreator) {
      throw new BadRequestException('您没有权限处理此申请');
    }

    // 检查申请状态
    if (request.status !== JoinRequestStatus.PENDING) {
      throw new BadRequestException('此申请已经被处理');
    }

    if (approve) {
      // 通过申请，添加成员
      if (!group.members.some((memberId) => memberId === request.user_id)) {
        group.members.push(request.user_id);
        group.member_count = group.members.length;
        await group.save();
      }

      // 更新申请状态
      request.status = JoinRequestStatus.APPROVED;
      request.processed_by = userId;
      request.processed_at = new Date();
      await request.save();

      return { success: true, message: '已通过加入申请' };
    } else {
      // 拒绝申请
      request.status = JoinRequestStatus.REJECTED;
      request.processed_by = userId;
      request.processed_at = new Date();
      request.reject_reason = rejectReason || '';
      await request.save();

      return { success: true, message: '已拒绝加入申请' };
    }
  }

  // 取消我的加入申请
  async cancelJoinRequest(
    requestId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const request = await this.groupJoinRequestModel
      .findOne({ id: requestId })
      .exec();

    if (!request) {
      throw new NotFoundException('申请不存在');
    }

    // 只能取消自己的申请
    if (request.user_id !== userId) {
      throw new BadRequestException('您只能取消自己的申请');
    }

    // 只能取消待处理的申请
    if (request.status !== JoinRequestStatus.PENDING) {
      throw new BadRequestException('此申请已经被处理，无法取消');
    }

    await this.groupJoinRequestModel.deleteOne({ id: requestId }).exec();

    return { success: true, message: '已取消加入申请' };
  }

  // 获取待处理申请数量（用于通知 badge）
  async getPendingJoinRequestCount(
    groupId: string,
    userId: string,
  ): Promise<number> {
    // 检查群组是否存在
    const group = await this.findById(groupId);

    // 检查权限（只有创建者或管理员可以查看）
    const isAdmin = group.admins.some((adminId) => adminId === userId);
    const isCreator = group.creator_id === userId;

    if (!isAdmin && !isCreator) {
      return 0;
    }

    return this.groupJoinRequestModel
      .countDocuments({
        group_id: groupId,
        status: JoinRequestStatus.PENDING,
      })
      .exec();
  }

  // ==================== 邀请相关方法 ====================

  // 创建邀请
  async createInvite(
    groupId: string,
    inviterId: string,
    inviterName: string,
    inviteeHandle: string,
  ): Promise<GroupInvite> {
    // 检查群组是否存在
    const group = await this.findById(groupId);

    // 检查权限（只有创建者或管理员可以邀请）
    const isAdmin = group.admins.some((adminId) => adminId === inviterId);
    const isCreator = group.creator_id === inviterId;

    if (!isAdmin && !isCreator) {
      throw new BadRequestException('您没有权限邀请成员');
    }

    // 检查是否已满员（假设最大100人）
    if (group.member_count >= 100) {
      throw new BadRequestException('社群成员已满，无法邀请新成员');
    }

    // 查找被邀请用户
    const invitee = await this.userModel
      .findOne({ handle: inviteeHandle })
      .exec();
    if (!invitee) {
      throw new BadRequestException('未找到该用户，请检查用户名是否正确');
    }

    // 检查是否已经是成员
    if (group.members.some((memberId) => memberId === invitee._id.toString())) {
      throw new BadRequestException('该用户已经是社群成员');
    }

    // 检查是否已有待处理的邀请
    const existingInvite = await this.groupInviteModel
      .findOne({
        group_id: groupId,
        invitee_id: invitee._id.toString(),
        status: InviteStatus.PENDING,
      })
      .exec();

    if (existingInvite) {
      throw new BadRequestException('已经向该用户发送过邀请，请等待对方处理');
    }

    // 创建邀请
    const inviteId = uuidv4();
    const invite = new this.groupInviteModel({
      id: inviteId,
      group_id: groupId,
      inviter_id: inviterId,
      inviter_name: inviterName,
      invitee_id: invitee._id.toString(),
      invitee_name: invitee.name,
      status: InviteStatus.PENDING,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后过期
    });

    await invite.save();

    // 发送通知给被邀请用户
    const notification = new this.notificationModel({
      recipient_id: invitee._id.toString(),
      sender_id: inviterId,
      type: NotificationType.GROUP_INVITE,
      title: '社群邀请',
      content: `${inviterName} 邀请您加入社群 "${group.name}"`,
      target_id: inviteId,
      target_type: 'group_invite',
      is_read: false,
    });
    await notification.save();

    return invite;
  }

  // 获取社群的邀请列表
  async getGroupInvites(
    groupId: string,
    userId: string,
  ): Promise<GroupInvite[]> {
    // 检查群组是否存在
    const group = await this.findById(groupId);

    // 检查权限（只有创建者或管理员可以查看）
    const isAdmin = group.admins.some((adminId) => adminId === userId);
    const isCreator = group.creator_id === userId;

    if (!isAdmin && !isCreator) {
      throw new BadRequestException('您没有权限查看邀请列表');
    }

    return this.groupInviteModel
      .find({ group_id: groupId })
      .sort({ createdAt: -1 })
      .exec();
  }

  // 获取我的邀请列表
  async getMyInvites(userId: string): Promise<GroupInvite[]> {
    return this.groupInviteModel
      .find({
        invitee_id: userId,
        status: InviteStatus.PENDING,
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  // 接受邀请
  async acceptInvite(
    inviteId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const invite = await this.groupInviteModel.findOne({ id: inviteId }).exec();

    if (!invite) {
      throw new NotFoundException('邀请不存在');
    }

    // 检查是否是邀请对象
    if (invite.invitee_id !== userId) {
      throw new BadRequestException('您没有权限处理此邀请');
    }

    // 检查邀请状态
    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException('此邀请已经处理过了');
    }

    // 检查是否过期
    if (new Date() > invite.expires_at) {
      invite.status = InviteStatus.EXPIRED;
      await invite.save();
      throw new BadRequestException('邀请已过期');
    }

    // 获取群组并添加成员
    const group = await this.findById(invite.group_id);

    if (!group.members.some((memberId) => memberId === userId)) {
      group.members.push(userId);
      group.member_count = group.members.length;
      await group.save();
    }

    // 更新邀请状态
    invite.status = InviteStatus.ACCEPTED;
    await invite.save();

    return { success: true, message: '已接受邀请，成功加入社群' };
  }

  // 拒绝邀请
  async rejectInvite(
    inviteId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const invite = await this.groupInviteModel.findOne({ id: inviteId }).exec();

    if (!invite) {
      throw new NotFoundException('邀请不存在');
    }

    // 检查是否是邀请对象
    if (invite.invitee_id !== userId) {
      throw new BadRequestException('您没有权限处理此邀请');
    }

    // 检查邀请状态
    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException('此邀请已经处理过了');
    }

    invite.status = InviteStatus.CANCELLED;
    await invite.save();

    return { success: true, message: '已拒绝邀请' };
  }

  // 取消邀请
  async cancelInvite(
    inviteId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const invite = await this.groupInviteModel.findOne({ id: inviteId }).exec();

    if (!invite) {
      throw new NotFoundException('邀请不存在');
    }

    // 检查权限（只有邀请者可以取消）
    if (invite.inviter_id !== userId) {
      throw new BadRequestException('您没有权限取消此邀请');
    }

    // 检查邀请状态
    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException('此邀请已经处理过了，无法取消');
    }

    invite.status = InviteStatus.CANCELLED;
    await invite.save();

    return { success: true, message: '已取消邀请' };
  }

  // ==================== 成员管理相关方法 ====================

  // 踢出成员
  async removeMember(
    groupId: string,
    memberId: string,
    operatorId: string,
  ): Promise<{ success: boolean; message: string }> {
    // 检查群组是否存在
    const group = await this.findById(groupId);

    // 检查权限（只有创建者或管理员可以踢人）
    const isAdmin = group.admins.some((adminId) => adminId === operatorId);
    const isCreator = group.creator_id === operatorId;

    if (!isAdmin && !isCreator) {
      throw new BadRequestException('您没有权限移除成员');
    }

    // 不能踢出自己
    if (memberId === operatorId) {
      throw new BadRequestException('不能移除自己');
    }

    // 不能踢出创建者
    if (memberId === group.creator_id) {
      throw new BadRequestException('不能移除社群创建者');
    }

    // 检查目标用户是否是成员
    if (!group.members.some((m) => m === memberId)) {
      throw new BadRequestException('该用户不是社群成员');
    }

    // 检查操作者权限是否足够（管理员不能踢其他管理员，只有创建者可以）
    const targetIsAdmin = group.admins.some((adminId) => adminId === memberId);
    if (targetIsAdmin && !isCreator) {
      throw new BadRequestException('只有创建者可以移除管理员');
    }

    // 从成员列表中移除
    group.members = group.members.filter((m) => m !== memberId);

    // 如果是管理员，也从管理员列表移除
    if (targetIsAdmin) {
      group.admins = group.admins.filter((a) => a !== memberId);
    }

    group.member_count = group.members.length;
    await group.save();

    return { success: true, message: '成员已移除' };
  }
}
