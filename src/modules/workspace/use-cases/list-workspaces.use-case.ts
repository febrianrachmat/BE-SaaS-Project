import { Injectable } from '@nestjs/common';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { toWorkspaceDto, WorkspaceDto } from '../mappers/workspace.mapper';

@Injectable()
export class ListWorkspacesUseCase {
  constructor(private readonly workspaces: WorkspaceRepository) {}

  async execute(userId: string): Promise<WorkspaceDto[]> {
    const memberships = await this.workspaces.listForUser(userId);

    return Promise.all(
      memberships.map(async (m) => {
        const memberCount = await this.workspaces.countMembers(m.workspaceId);
        return toWorkspaceDto(m.workspace, {
          role: m.role,
          memberCount,
        });
      }),
    );
  }
}
