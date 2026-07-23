import { Injectable, NotFoundException } from '@nestjs/common';
import { ApiKey } from '@prisma/client';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import {
  generateSecureToken,
  hashToken,
} from '../../../common/utils/crypto.util';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateApiKeyDto } from '../dto/integrations.dto';

const KEY_PREFIX_LEN = 12;

export type ApiKeyDto = {
  id: string;
  workspaceId: string;
  name: string;
  keyPrefix: string;
  createdById: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type CreatedApiKeyDto = ApiKeyDto & {
  /** Plaintext key — returned only once on create. */
  key: string;
};

function toApiKeyDto(row: ApiKey): ApiKeyDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    keyPrefix: row.keyPrefix,
    createdById: row.createdById,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ctx: WorkspaceContext): Promise<ApiKeyDto[]> {
    const rows = await this.prisma.apiKey.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toApiKeyDto);
  }

  async create(
    ctx: WorkspaceContext,
    actorId: string,
    dto: CreateApiKeyDto,
  ): Promise<CreatedApiKeyDto> {
    const raw = `fp_live_${generateSecureToken(24)}`;
    const keyHash = hashToken(raw);
    const keyPrefix = raw.slice(0, KEY_PREFIX_LEN);

    const row = await this.prisma.apiKey.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: dto.name.trim(),
        keyHash,
        keyPrefix,
        createdById: actorId,
      },
    });

    return { ...toApiKeyDto(row), key: raw };
  }

  async revoke(
    ctx: WorkspaceContext,
    apiKeyId: string,
  ): Promise<ApiKeyDto> {
    const existing = await this.requireApiKey(ctx, apiKeyId);
    if (existing.revokedAt) {
      return toApiKeyDto(existing);
    }
    const row = await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { revokedAt: new Date() },
    });
    return toApiKeyDto(row);
  }

  /**
   * Validate a plaintext API key. Returns workspace + creator user ids.
   */
  async validate(
    rawKey: string,
  ): Promise<{
    apiKeyId: string;
    workspaceId: string;
    userId: string;
  } | null> {
    const trimmed = rawKey.trim();
    if (!trimmed.startsWith('fp_live_')) return null;

    const keyHash = hashToken(trimmed);
    const row = await this.prisma.apiKey.findFirst({
      where: { keyHash, revokedAt: null },
      select: {
        id: true,
        workspaceId: true,
        createdById: true,
      },
    });
    if (!row) return null;

    // Fire-and-forget last used stamp
    void this.prisma.apiKey
      .update({
        where: { id: row.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => undefined);

    return {
      apiKeyId: row.id,
      workspaceId: row.workspaceId,
      userId: row.createdById,
    };
  }

  private async requireApiKey(
    ctx: WorkspaceContext,
    apiKeyId: string,
  ): Promise<ApiKey> {
    const row = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, workspaceId: ctx.workspaceId },
    });
    if (!row) {
      throw new NotFoundException('API key not found');
    }
    return row;
  }
}
