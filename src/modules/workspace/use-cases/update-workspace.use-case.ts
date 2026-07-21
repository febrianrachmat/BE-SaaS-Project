import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateWorkspaceDto } from '../dto/update-workspace.dto';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { toWorkspaceDto, WorkspaceDto } from '../mappers/workspace.mapper';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class UpdateWorkspaceUseCase {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    ctx: WorkspaceContext,
    actorId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceDto> {
    const existing = await this.workspaces.findById(ctx.workspaceId);
    if (!existing) {
      throw new NotFoundException('Workspace not found');
    }

    const workspace = await this.workspaces.update(ctx.workspaceId, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
      ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
    });

    await this.prisma.activityLog.create({
      data: {
        workspaceId: workspace.id,
        actorId,
        action: 'WORKSPACE_UPDATED',
        metadata: { ...dto },
      },
    });

    const memberCount = await this.workspaces.countMembers(workspace.id);
    return toWorkspaceDto(workspace, { role: ctx.role, memberCount });
  }
}
