import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { toWorkspaceDto, WorkspaceDto } from '../mappers/workspace.mapper';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';

@Injectable()
export class GetWorkspaceUseCase {
  constructor(private readonly workspaces: WorkspaceRepository) {}

  async execute(ctx: WorkspaceContext): Promise<WorkspaceDto> {
    const workspace = await this.workspaces.findById(ctx.workspaceId);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const memberCount = await this.workspaces.countMembers(workspace.id);
    return toWorkspaceDto(workspace, {
      role: ctx.role,
      memberCount,
    });
  }
}
