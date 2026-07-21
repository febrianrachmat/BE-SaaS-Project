import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { toWorkspaceDto, WorkspaceDto } from '../mappers/workspace.mapper';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class ArchiveWorkspaceUseCase {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    ctx: WorkspaceContext,
    actorId: string,
    archive: boolean,
  ): Promise<WorkspaceDto> {
    const existing = await this.workspaces.findById(ctx.workspaceId);
    if (!existing) {
      throw new NotFoundException('Workspace not found');
    }

    if (archive && existing.archivedAt) {
      throw new BadRequestException('Workspace is already archived');
    }
    if (!archive && !existing.archivedAt) {
      throw new BadRequestException('Workspace is not archived');
    }

    const workspace = await this.workspaces.update(ctx.workspaceId, {
      archivedAt: archive ? new Date() : null,
    });

    await this.prisma.activityLog.create({
      data: {
        workspaceId: workspace.id,
        actorId,
        action: 'WORKSPACE_UPDATED',
        metadata: { archived: archive },
      },
    });

    const memberCount = await this.workspaces.countMembers(workspace.id);
    return toWorkspaceDto(workspace, { role: ctx.role, memberCount });
  }
}
