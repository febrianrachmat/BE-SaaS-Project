import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cycle, CycleStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { WorkspaceContext } from '../../../common/decorators/current-workspace.decorator';
import { CreateCycleDto, UpdateCycleDto } from '../dto/cycle.dto';

export type CycleDto = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: CycleStatus;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
};

function toCycleDto(
  cycle: Cycle & { _count?: { tasks: number } },
): CycleDto {
  return {
    id: cycle.id,
    workspaceId: cycle.workspaceId,
    name: cycle.name,
    description: cycle.description,
    status: cycle.status,
    startDate: cycle.startDate?.toISOString() ?? null,
    endDate: cycle.endDate?.toISOString() ?? null,
    createdAt: cycle.createdAt.toISOString(),
    updatedAt: cycle.updatedAt.toISOString(),
    taskCount: cycle._count?.tasks,
  };
}

@Injectable()
export class CycleService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ctx: WorkspaceContext): Promise<CycleDto[]> {
    const rows = await this.prisma.cycle.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: {
        _count: {
          select: { tasks: { where: { deletedAt: null } } },
        },
      },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toCycleDto);
  }

  async create(
    ctx: WorkspaceContext,
    dto: CreateCycleDto,
  ): Promise<CycleDto> {
    this.assertDateOrder(dto.startDate, dto.endDate);

    if (dto.status === CycleStatus.ACTIVE) {
      await this.completeOtherActive(ctx.workspaceId);
    }

    const cycle = await this.prisma.cycle.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        status: dto.status ?? CycleStatus.PLANNED,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
      include: {
        _count: {
          select: { tasks: { where: { deletedAt: null } } },
        },
      },
    });
    return toCycleDto(cycle);
  }

  async update(
    ctx: WorkspaceContext,
    cycleId: string,
    dto: UpdateCycleDto,
  ): Promise<CycleDto> {
    const existing = await this.requireCycle(ctx, cycleId);
    this.assertDateOrder(
      dto.startDate !== undefined
        ? dto.startDate
        : (existing.startDate?.toISOString() ?? null),
      dto.endDate !== undefined
        ? dto.endDate
        : (existing.endDate?.toISOString() ?? null),
    );

    if (
      dto.status === CycleStatus.ACTIVE &&
      existing.status !== CycleStatus.ACTIVE
    ) {
      await this.completeOtherActive(ctx.workspaceId, cycleId);
    }

    const cycle = await this.prisma.cycle.update({
      where: { id: cycleId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: dto.startDate ? new Date(dto.startDate) : null }
          : {}),
        ...(dto.endDate !== undefined
          ? { endDate: dto.endDate ? new Date(dto.endDate) : null }
          : {}),
      },
      include: {
        _count: {
          select: { tasks: { where: { deletedAt: null } } },
        },
      },
    });
    return toCycleDto(cycle);
  }

  async activate(ctx: WorkspaceContext, cycleId: string): Promise<CycleDto> {
    await this.requireCycle(ctx, cycleId);
    await this.completeOtherActive(ctx.workspaceId, cycleId);

    const cycle = await this.prisma.cycle.update({
      where: { id: cycleId },
      data: { status: CycleStatus.ACTIVE },
      include: {
        _count: {
          select: { tasks: { where: { deletedAt: null } } },
        },
      },
    });
    return toCycleDto(cycle);
  }

  async complete(ctx: WorkspaceContext, cycleId: string): Promise<CycleDto> {
    await this.requireCycle(ctx, cycleId);

    const cycle = await this.prisma.cycle.update({
      where: { id: cycleId },
      data: { status: CycleStatus.COMPLETED },
      include: {
        _count: {
          select: { tasks: { where: { deletedAt: null } } },
        },
      },
    });
    return toCycleDto(cycle);
  }

  async remove(
    ctx: WorkspaceContext,
    cycleId: string,
  ): Promise<{ message: string }> {
    await this.requireCycle(ctx, cycleId);
    // FK onDelete: SetNull clears task.cycleId
    await this.prisma.cycle.delete({ where: { id: cycleId } });
    return { message: 'Cycle deleted' };
  }

  private async requireCycle(
    ctx: WorkspaceContext,
    cycleId: string,
  ): Promise<Cycle> {
    const cycle = await this.prisma.cycle.findFirst({
      where: { id: cycleId, workspaceId: ctx.workspaceId },
    });
    if (!cycle) {
      throw new NotFoundException('Cycle not found');
    }
    return cycle;
  }

  private async completeOtherActive(
    workspaceId: string,
    exceptId?: string,
  ): Promise<void> {
    await this.prisma.cycle.updateMany({
      where: {
        workspaceId,
        status: CycleStatus.ACTIVE,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { status: CycleStatus.COMPLETED },
    });
  }

  private assertDateOrder(
    startDate?: string | null,
    endDate?: string | null,
  ) {
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new BadRequestException('startDate must be before endDate');
    }
  }
}
