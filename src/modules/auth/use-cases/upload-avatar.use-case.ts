import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync } from 'fs';
import type * as express from 'express';
import { OBJECT_STORAGE } from '../../../infrastructure/storage/storage.module';
import type { ObjectStorage } from '../../../infrastructure/storage/storage.types';
import { UserRepository } from '../repositories/user.repository';
import { toPublicUser, PublicUser } from '../mappers/user.mapper';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

const EXT_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

@Injectable()
export class UploadAvatarUseCase {
  private readonly maxBytes: number;

  constructor(
    private readonly users: UserRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly config: ConfigService,
  ) {
    this.maxBytes = 5 * 1024 * 1024;
  }

  async execute(
    userId: string,
    file: Express.Multer.File,
  ): Promise<PublicUser> {
    const existing = await this.users.findById(userId);
    if (!existing) throw new UnauthorizedException('User not found');
    if (!file) throw new BadRequestException('File is required');
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, GIF, or WebP images allowed');
    }
    if (file.size > this.maxBytes) {
      throw new BadRequestException('Avatar must be 5MB or smaller');
    }

    await this.deleteExistingKeys(userId);

    const ext = MIME_EXT[file.mimetype] ?? '.jpg';
    const key = `avatars/${userId}/avatar${ext}`;
    await this.storage.put(key, file.buffer, file.mimetype);

    const publicBase = (
      this.config.get<string>('PUBLIC_API_URL') ||
      this.config.get<string>('API_PUBLIC_URL') ||
      'http://localhost:4000/v1'
    ).replace(/\/$/, '');

    const avatarUrl = `${publicBase}/auth/avatars/${userId}?v=${Date.now()}`;
    const user = await this.users.updateProfile(userId, { avatarUrl });
    return toPublicUser(user);
  }

  async streamAvatar(userId: string, res: express.Response): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const resolved = await this.resolveKey(userId);
    if (!resolved) throw new NotFoundException('Avatar not found');

    const signed = await this.storage.getDownloadUrl(
      resolved.key,
      `avatar${resolved.ext}`,
      3600,
    );
    if (signed) {
      res.redirect(302, signed);
      return;
    }

    const path = this.storage.getLocalPath(resolved.key);
    if (!path || !existsSync(path)) {
      throw new NotFoundException('Avatar file missing');
    }

    res.setHeader('Content-Type', resolved.mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    createReadStream(path).pipe(res);
  }

  private async resolveKey(
    userId: string,
  ): Promise<{ key: string; ext: string; mime: string } | null> {
    for (const [ext, mime] of Object.entries(EXT_MIME)) {
      const key = `avatars/${userId}/avatar${ext === '.jpeg' ? '.jpg' : ext}`;
      if (ext === '.jpeg') continue;
      if (await this.storage.exists(key)) {
        return { key, ext, mime };
      }
    }
    return null;
  }

  private async deleteExistingKeys(userId: string) {
    for (const ext of Object.keys(EXT_MIME)) {
      if (ext === '.jpeg') continue;
      const key = `avatars/${userId}/avatar${ext}`;
      if (await this.storage.exists(key)) {
        await this.storage.delete(key);
      }
    }
  }
}
