import { Module } from '@nestjs/common';
import { IntegrationsController } from './controllers/integrations.controller';
import { WebhookService } from './services/webhook.service';
import { ApiKeyService } from './services/api-key.service';

@Module({
  controllers: [IntegrationsController],
  providers: [WebhookService, ApiKeyService],
  exports: [WebhookService, ApiKeyService],
})
export class IntegrationsModule {}
