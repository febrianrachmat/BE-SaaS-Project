export type StoredObject = {
  key: string;
};

export interface ObjectStorage {
  readonly driver: 'local' | 's3';
  put(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Absolute path for local streaming; null for cloud drivers. */
  getLocalPath(key: string): string | null;
  /** Signed or direct URL for download; null when caller should stream locally. */
  getDownloadUrl(
    key: string,
    fileName: string,
    expiresInSeconds?: number,
  ): Promise<string | null>;
}
