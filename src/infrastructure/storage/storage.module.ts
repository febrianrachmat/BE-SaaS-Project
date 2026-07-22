import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalObjectStorage } from './local-object-storage';
import { S3ObjectStorage } from './s3-object-storage';
import type { ObjectStorage } from './storage.types';

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: OBJECT_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ObjectStorage => {
        const driver = (
          config.get<string>('STORAGE_DRIVER') ?? 'local'
        ).toLowerCase();
        const logger = new Logger('StorageModule');

        if (driver === 's3') {
          logger.log('Using S3/R2 object storage');
          return new S3ObjectStorage(config);
        }

        logger.log('Using local object storage');
        return new LocalObjectStorage(config);
      },
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
