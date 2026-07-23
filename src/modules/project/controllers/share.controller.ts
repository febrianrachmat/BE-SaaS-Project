import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { ShareLinkService } from '../services/share-link.service';

@ApiTags('share')
@Controller('share')
export class ShareController {
  constructor(private readonly shareLinks: ShareLinkService) {}

  @Get(':token')
  @Public()
  @ApiOperation({ summary: 'Resolve a read-only project share link' })
  resolve(@Param('token') token: string) {
    return this.shareLinks.resolve(token);
  }
}
