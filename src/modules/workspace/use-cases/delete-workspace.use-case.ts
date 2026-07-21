import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';

@Injectable()
export class DeleteWorkspaceUseCase {
  constructor(private readonly workspaces: WorkspaceRepository) {}

  async execute(ctx: WorkspaceContext): Promise<{ message: string }> {
    const existing = await this.workspaces.findById(ctx.workspaceId);
    if (!existing) {
      throw new NotFoundException('Workspace not found');
    }

    await this.workspaces.softDelete(ctx.workspaceId);
    return { message: 'Workspace deleted' };
  }
}
