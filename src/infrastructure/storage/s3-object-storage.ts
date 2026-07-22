import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ObjectStorage, StoredObject } from './storage.types';

@Injectable()
export class S3ObjectStorage implements ObjectStorage {
  readonly driver = 's3' as const;
  private readonly logger = new Logger(S3ObjectStorage.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const bucket = config.get<string>('S3_BUCKET')?.trim();
    const accessKeyId = config.get<string>('S3_ACCESS_KEY_ID')?.trim();
    const secretAccessKey = config.get<string>('S3_SECRET_ACCESS_KEY')?.trim();
    const region = config.get<string>('S3_REGION', 'auto');
    const endpoint = config.get<string>('S3_ENDPOINT')?.trim();
    const forcePathStyle = ['1', 'true', 'yes'].includes(
      (config.get<string>('S3_FORCE_PATH_STYLE') ?? 'true').toLowerCase(),
    );

    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'S3 storage requires S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY',
      );
    }

    this.bucket = bucket;
    this.client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.logger.log(
      `S3 storage ready (bucket=${bucket}${endpoint ? `, endpoint=${endpoint}` : ''})`,
    );
  }

  async put(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return { key };
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to delete S3 object ${key}: ${(error as Error).message}`,
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  getLocalPath(): string | null {
    return null;
  }

  async getDownloadUrl(
    key: string,
    fileName: string,
    expiresInSeconds = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${fileName.replace(/"/g, '')}"`,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });
  }
}
