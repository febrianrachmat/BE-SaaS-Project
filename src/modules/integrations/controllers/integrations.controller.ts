import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { CurrentWorkspace } from '../../../common/decorators/current-workspace.decorator';
import type { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/rbac';
import { WebhookService } from '../services/webhook.service';
import { ApiKeyService } from '../services/api-key.service';
import {
  CreateApiKeyDto,
  CreateWebhookDto,
  UpdateWebhookDto,
} from '../dto/integrations.dto';

@ApiTags('integrations')
@ApiBearerAuth()
@ApiCookieAuth('access_token')
@Controller('workspaces/:slug')
export class IntegrationsController {
  constructor(
    private readonly webhooks: WebhookService,
    private readonly apiKeys: ApiKeyService,
  ) {}

  // ─── Webhooks ────────────────────────────────────────────────────────────

  @Get('webhooks')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'List workspace webhooks' })
  listWebhooks(@CurrentWorkspace() ctx: WorkspaceContext) {
    return this.webhooks.list(ctx);
  }

  @Post('webhooks')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Create a webhook' })
  createWebhook(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.webhooks.create(ctx, user.id, dto);
  }

  @Patch('webhooks/:webhookId')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Update a webhook' })
  updateWebhook(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('webhookId') webhookId: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooks.update(ctx, webhookId, dto);
  }

  @Delete('webhooks/:webhookId')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Delete a webhook' })
  removeWebhook(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('webhookId') webhookId: string,
  ) {
    return this.webhooks.remove(ctx, webhookId);
  }

  @Get('webhooks/:webhookId/deliveries')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'List recent webhook delivery attempts' })
  listWebhookDeliveries(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('webhookId') webhookId: string,
  ) {
    return this.webhooks.listDeliveries(ctx, webhookId);
  }

  @Post('webhooks/:webhookId/deliveries/:deliveryId/retry')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Retry a webhook delivery' })
  retryWebhookDelivery(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('webhookId') webhookId: string,
    @Param('deliveryId') deliveryId: string,
  ) {
    return this.webhooks.retryDelivery(ctx, webhookId, deliveryId);
  }

  // ─── API keys ────────────────────────────────────────────────────────────

  @Get('api-keys')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'List workspace API keys' })
  listApiKeys(@CurrentWorkspace() ctx: WorkspaceContext) {
    return this.apiKeys.list(ctx);
  }

  @Post('api-keys')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({
    summary: 'Create an API key (plaintext returned once)',
  })
  createApiKey(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeys.create(ctx, user.id, dto);
  }

  @Post('api-keys/:apiKeyId/revoke')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Revoke an API key' })
  revokeApiKey(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('apiKeyId') apiKeyId: string,
  ) {
    return this.apiKeys.revoke(ctx, apiKeyId);
  }

  @Post('api-keys/:apiKeyId/rotate')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({
    summary: 'Rotate an API key (revoke old, return new plaintext once)',
  })
  rotateApiKey(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @CurrentUser() user: AuthUser,
    @Param('apiKeyId') apiKeyId: string,
  ) {
    return this.apiKeys.rotate(ctx, apiKeyId, user.id);
  }
}
