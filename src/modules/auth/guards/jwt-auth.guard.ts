import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { hashToken } from '../../../common/utils/crypto.util';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';

export type ApiKeyAuthContext = {
  apiKeyId: string;
  workspaceId: string;
  scopes: string[];
};

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: AuthUser;
      apiKeyAuth?: ApiKeyAuthContext;
    }>();

    const rawKey = this.extractApiKey(request.headers);
    if (rawKey) {
      const validated = await this.validateApiKey(rawKey);
      if (!validated) {
        throw new UnauthorizedException('Invalid API key');
      }
      request.user = validated.user;
      request.apiKeyAuth = {
        apiKeyId: validated.apiKeyId,
        workspaceId: validated.workspaceId,
        scopes: validated.scopes,
      };
      return true;
    }

    const result = super.canActivate(context);
    if (typeof result === 'boolean') return result;
    return result as Promise<boolean>;
  }

  private extractApiKey(
    headers: Record<string, string | string[] | undefined>,
  ): string | null {
    const header = headers['x-api-key'];
    if (typeof header === 'string' && header.trim()) {
      return header.trim();
    }
    const auth = headers.authorization;
    if (typeof auth === 'string' && auth.toLowerCase().startsWith('apikey ')) {
      return auth.slice(7).trim();
    }
    return null;
  }

  private async validateApiKey(rawKey: string): Promise<{
    user: AuthUser;
    apiKeyId: string;
    workspaceId: string;
    scopes: string[];
  } | null> {
    if (!rawKey.startsWith('fp_live_')) return null;

    const keyHash = hashToken(rawKey);
    const row = await this.prisma.apiKey.findFirst({
      where: { keyHash, revokedAt: null },
      select: {
        id: true,
        workspaceId: true,
        createdById: true,
        scopes: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            systemRole: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!row || row.createdBy.deletedAt) return null;

    void this.prisma.apiKey
      .update({
        where: { id: row.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => undefined);

    return {
      apiKeyId: row.id,
      workspaceId: row.workspaceId,
      scopes: row.scopes ?? [],
      user: {
        id: row.createdBy.id,
        email: row.createdBy.email,
        systemRole: row.createdBy.systemRole,
      },
    };
  }
}
