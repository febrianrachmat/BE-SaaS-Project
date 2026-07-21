import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { toWorkspaceDto, WorkspaceDto } from '../mappers/workspace.mapper';
import { slugify, withSlugSuffix } from '../../../common/utils/slug.util';

@Injectable()
export class CreateWorkspaceUseCase {
  constructor(private readonly workspaces: WorkspaceRepository) {}

  async execute(
    userId: string,
    dto: CreateWorkspaceDto,
  ): Promise<WorkspaceDto> {
    const baseSlug = slugify(dto.slug?.trim() || dto.name);
    if (!baseSlug) {
      throw new BadRequestException('Unable to generate a valid slug');
    }

    let slug = baseSlug;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      slug = withSlugSuffix(baseSlug, attempt);
      const taken = await this.workspaces.slugExists(slug);
      if (!taken) break;
      if (attempt === 19) {
        throw new ConflictException('Unable to allocate a unique slug');
      }
    }

    const workspace = await this.workspaces.createWithOwner({
      name: dto.name.trim(),
      slug,
      description: dto.description?.trim(),
      timezone: dto.timezone,
      ownerId: userId,
    });

    return toWorkspaceDto(workspace, { role: 'OWNER', memberCount: 1 });
  }
}
