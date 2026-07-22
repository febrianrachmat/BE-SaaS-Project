import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  unlinkSync,
} from 'fs';
import { dirname, join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import type { ObjectStorage, StoredObject } from './storage.types';

@Injectable()
export class LocalObjectStorage implements ObjectStorage {
  readonly driver = 'local' as const;
  private readonly logger = new Logger(LocalObjectStorage.name);
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = config.get<string>('STORAGE_LOCAL_PATH', './uploads');
    if (!existsSync(this.root)) {
      mkdirSync(this.root, { recursive: true });
    }
  }

  async put(
    key: string,
    body: Buffer,
    _contentType: string,
  ): Promise<StoredObject> {
    const fullPath = this.resolve(key);
    mkdirSync(dirname(fullPath), { recursive: true });
    await pipeline(Readable.from(body), createWriteStream(fullPath));
    return { key };
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.resolve(key);
    if (!existsSync(fullPath)) return;
    try {
      unlinkSync(fullPath);
    } catch (error) {
      this.logger.warn(
        `Failed to delete local object ${key}: ${(error as Error).message}`,
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    return existsSync(this.resolve(key));
  }

  getLocalPath(key: string): string {
    return this.resolve(key);
  }

  async getDownloadUrl(): Promise<string | null> {
    return null;
  }

  private resolve(key: string): string {
    const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '');
    if (normalized.includes('..')) {
      throw new Error('Invalid storage key');
    }
    return join(this.root, normalized);
  }
}
