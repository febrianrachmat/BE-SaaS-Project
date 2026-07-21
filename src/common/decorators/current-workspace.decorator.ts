import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';

export type WorkspaceContext = {
  workspaceId: string;
  slug: string;
  role: WorkspaceRole;
  membershipId: string;
};

export const CurrentWorkspace = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): WorkspaceContext => {
    const request = ctx.switchToHttp().getRequest<{
      workspaceContext: WorkspaceContext;
    }>();
    return request.workspaceContext;
  },
);
