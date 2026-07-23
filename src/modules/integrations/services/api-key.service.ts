import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApiKey } from '@prisma/client';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { PERMISSIONS } from '../../../common/constants/rbac';
import {
  generateSecureToken,
  hashToken,
} from '../../../common/utils/crypto.util';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { SecurityAuditService } from '../../../common/services/security-audit.service';
import { CreateApiKeyDto } from '../dto/integrations.dto';

const KEY_PREFIX_LEN = 12;

const ALLOWED_SCOPES = new Set<string>(Object.values(PERMISSIONS));

export type ApiKeyDto = {
  id: string;
  workspaceId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
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
    scopes: row.scopes ?? [],
    createdById: row.createdById,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function normalizeScopes(scopes: string[] | undefined): string[] {
  if (!scopes?.length) return [];
  const unique = [...new Set(scopes.map((s) => s.trim()).filter(Boolean))];
  const invalid = unique.filter((s) => !ALLOWED_SCOPES.has(s));
  if (invalid.length) {
    throw new BadRequestException(
      `Invalid API key scopes: ${invalid.join(', ')}`,
    );
  }
  return unique;
}

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: SecurityAuditService,
  ) {}

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
    meta?: { ip?: string; userAgent?: string },
  ): Promise<CreatedApiKeyDto> {
    const scopes = normalizeScopes(dto.scopes);
    const raw = `fp_live_${generateSecureToken(24)}`;
    const keyHash = hashToken(raw);
    const keyPrefix = raw.slice(0, KEY_PREFIX_LEN);

    const row = await this.prisma.apiKey.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: dto.name.trim(),
        keyHash,
        keyPrefix,
        scopes,
        createdById: actorId,
      },
    });

    await this.audit.write({
      action: 'API_KEY_CREATED',
      actorId,
      workspaceId: ctx.workspaceId,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { apiKeyId: row.id, name: row.name, scopes },
    });

    return { ...toApiKeyDto(row), key: raw };
  }

  async revoke(
    ctx: WorkspaceContext,
    apiKeyId: string,
    actorId: string,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<ApiKeyDto> {
    const existing = await this.requireApiKey(ctx, apiKeyId);
    if (existing.revokedAt) {
      return toApiKeyDto(existing);
    }
    const row = await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { revokedAt: new Date() },
    });

    await this.audit.write({
      action: 'API_KEY_REVOKED',
      actorId,
      workspaceId: ctx.workspaceId,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { apiKeyId: row.id, name: row.name },
    });

    return toApiKeyDto(row);
  }

  /**
   * Revoke the current key and mint a replacement with the same name + scopes.
   */
  async rotate(
    ctx: WorkspaceContext,
    apiKeyId: string,
    actorId: string,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<CreatedApiKeyDto> {
    const existing = await this.requireApiKey(ctx, apiKeyId);
    if (existing.revokedAt) {
      throw new NotFoundException('API key is already revoked');
    }
    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { revokedAt: new Date() },
    });

    const raw = `fp_live_${generateSecureToken(24)}`;
    const keyHash = hashToken(raw);
    const keyPrefix = raw.slice(0, KEY_PREFIX_LEN);
    const row = await this.prisma.apiKey.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: existing.name,
        keyHash,
        keyPrefix,
        scopes: existing.scopes ?? [],
        createdById: actorId,
      },
    });

    await this.audit.write({
      action: 'API_KEY_ROTATED',
      actorId,
      workspaceId: ctx.workspaceId,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: {
        oldApiKeyId: existing.id,
        newApiKeyId: row.id,
        name: existing.name,
        scopes: existing.scopes ?? [],
      },
    });

    return { ...toApiKeyDto(row), key: raw };
  }

  /**
   * Validate a plaintext API key. Returns workspace + creator user ids.
   */
  async validate(rawKey: string): Promise<{
    apiKeyId: string;
    workspaceId: string;
    userId: string;
    scopes: string[];
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
        scopes: true,
      },
    });
    if (!row) return null;

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
      scopes: row.scopes ?? [],
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
