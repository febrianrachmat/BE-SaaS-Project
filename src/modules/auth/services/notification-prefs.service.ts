import { Injectable } from '@nestjs/common';
import { NotificationPreference } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { UpdateNotificationPrefsDto } from '../dto/update-notification-prefs.dto';

export type NotificationPrefsDto = {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  taskAssigned: boolean;
  taskUpdated: boolean;
  commentAdded: boolean;
  mention: boolean;
  invitation: boolean;
  dueSoon: boolean;
  completed: boolean;
};

@Injectable()
export class NotificationPrefsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(userId: string): Promise<NotificationPrefsDto> {
    const existing = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (existing) return this.toDto(existing);

    const created = await this.prisma.notificationPreference.create({
      data: { userId },
    });
    return this.toDto(created);
  }

  async update(
    userId: string,
    dto: UpdateNotificationPrefsDto,
  ): Promise<NotificationPrefsDto> {
    await this.getOrCreate(userId);
    const updated = await this.prisma.notificationPreference.update({
      where: { userId },
      data: {
        ...(dto.emailEnabled !== undefined
          ? { emailEnabled: dto.emailEnabled }
          : {}),
        ...(dto.inAppEnabled !== undefined
          ? { inAppEnabled: dto.inAppEnabled }
          : {}),
        ...(dto.taskAssigned !== undefined
          ? { taskAssigned: dto.taskAssigned }
          : {}),
        ...(dto.taskUpdated !== undefined
          ? { taskUpdated: dto.taskUpdated }
          : {}),
        ...(dto.commentAdded !== undefined
          ? { commentAdded: dto.commentAdded }
          : {}),
        ...(dto.mention !== undefined ? { mention: dto.mention } : {}),
        ...(dto.invitation !== undefined
          ? { invitation: dto.invitation }
          : {}),
        ...(dto.dueSoon !== undefined ? { dueSoon: dto.dueSoon } : {}),
        ...(dto.completed !== undefined ? { completed: dto.completed } : {}),
      },
    });
    return this.toDto(updated);
  }

  private toDto(row: NotificationPreference): NotificationPrefsDto {
    return {
      emailEnabled: row.emailEnabled,
      inAppEnabled: row.inAppEnabled,
      taskAssigned: row.taskAssigned,
      taskUpdated: row.taskUpdated,
      commentAdded: row.commentAdded,
      mention: row.mention,
      invitation: row.invitation,
      dueSoon: row.dueSoon,
      completed: row.completed,
    };
  }
}
