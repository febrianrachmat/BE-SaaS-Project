import { Injectable } from '@nestjs/common';
import { WorkspaceMemberRepository } from '../repositories/workspace-member.repository';
import { toMemberDto, MemberDto } from '../mappers/workspace.mapper';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';

@Injectable()
export class ListMembersUseCase {
  constructor(private readonly members: WorkspaceMemberRepository) {}

  async execute(ctx: WorkspaceContext): Promise<MemberDto[]> {
    const list = await this.members.list(ctx.workspaceId);
    return list.map(toMemberDto);
  }
}
