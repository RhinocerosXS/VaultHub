import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(createUserDto: any): Promise<User> {
    const createdUser = new this.userModel(createUserDto);
    return createdUser.save();
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findOneByHandle(handle: string): Promise<User | null> {
    return this.userModel.findOne({ handle }).exec();
  }

  async findOneById(id: string): Promise<User | null> {
    return this.userModel.findById(id).exec();
  }

  async update(
    id: string,
    updateData: { name?: string; bio?: string },
  ): Promise<User | null> {
    return this.userModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .exec();
  }

  async updateLastActive(id: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, { $set: { lastActiveAt: new Date() } })
      .exec();
  }

  async getActiveUsersCount(days: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return this.userModel
      .countDocuments({
        lastActiveAt: { $gte: cutoffDate },
      })
      .exec();
  }
}
