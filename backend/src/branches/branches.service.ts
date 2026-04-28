import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly audit: AuditService,
  ) {}

  private firmId(): string {
    const id = this.cls.get<string>('firmId');
    if (!id) throw new ForbiddenException('No firm context');
    return id;
  }

  async findAll() {
    return this.prisma.branch.findMany({
      where: { firmId: this.firmId() },
      orderBy: [{ isHq: 'desc' }, { name: 'asc' }],
      include: {
        head: { select: { id: true, name: true } },
        _count: { select: { users: true, clients: true } },
      },
    });
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, firmId: this.firmId() },
      include: {
        head: { select: { id: true, name: true } },
        _count: { select: { users: true, clients: true } },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async create(dto: CreateBranchDto) {
    const firmId = this.firmId();
    if (dto.headUserId) {
      const u = await this.prisma.user.findFirst({
        where: { id: dto.headUserId, firmId },
      });
      if (!u) throw new NotFoundException('Head user not found');
    }

    try {
      const branch = await this.prisma.$transaction(async (tx) => {
        if (dto.isHq) {
          // Only one HQ per firm — demote any existing HQ first
          await tx.branch.updateMany({
            where: { firmId, isHq: true },
            data: { isHq: false },
          });
        }
        return tx.branch.create({
          data: {
            firmId,
            name: dto.name.trim(),
            city: dto.city.trim(),
            address: dto.address,
            isHq: dto.isHq ?? false,
            headUserId: dto.headUserId,
          },
        });
      });

      await this.audit.log({
        action: 'CREATE',
        entityType: 'branch',
        entityId: branch.id,
        payload: { name: branch.name, city: branch.city, isHq: branch.isHq },
      });
      return branch;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('A branch with this name already exists in your firm');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateBranchDto) {
    const firmId = this.firmId();
    const existing = await this.findOne(id);

    if (dto.headUserId) {
      const u = await this.prisma.user.findFirst({
        where: { id: dto.headUserId, firmId },
      });
      if (!u) throw new NotFoundException('Head user not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isHq && !existing.isHq) {
        await tx.branch.updateMany({
          where: { firmId, isHq: true, id: { not: id } },
          data: { isHq: false },
        });
      } else if (dto.isHq === false && existing.isHq) {
        // Don't allow demoting the only HQ if it's the last one
        const otherHq = await tx.branch.count({
          where: { firmId, isHq: true, id: { not: id } },
        });
        if (otherHq === 0) {
          throw new BadRequestException('At least one branch must be HQ');
        }
      }
      return tx.branch.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          city: dto.city?.trim(),
          address: dto.address,
          isHq: dto.isHq,
          headUserId: dto.headUserId,
        },
      });
    });

    await this.audit.log({
      action: 'UPDATE',
      entityType: 'branch',
      entityId: id,
      payload: { id, before: existing, after: updated },
    });
    return updated;
  }

  /**
   * Hard-delete a branch. Refuses if the branch has any users or clients
   * still attached, AND won't let you delete the only HQ. Reassign or
   * archive the dependent records first.
   */
  async remove(id: string) {
    const firmId = this.firmId();
    const branch = await this.prisma.branch.findFirst({
      where: { id, firmId },
      include: { _count: { select: { users: true, clients: true } } },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    if (branch._count.users > 0 || branch._count.clients > 0) {
      throw new BadRequestException(
        `Cannot delete: this branch has ${branch._count.users} user(s) and ${branch._count.clients} client(s). Reassign or archive them first.`,
      );
    }

    if (branch.isHq) {
      const otherCount = await this.prisma.branch.count({
        where: { firmId, id: { not: id } },
      });
      if (otherCount === 0) {
        throw new BadRequestException(
          'Cannot delete the only branch. Create another branch first.',
        );
      }
      throw new BadRequestException(
        'Cannot delete an HQ branch. Promote another branch to HQ first.',
      );
    }

    await this.prisma.branch.delete({ where: { id } });
    await this.audit.log({
      action: 'DELETE',
      entityType: 'branch',
      entityId: id,
      payload: { name: branch.name, city: branch.city },
    });
    return { ok: true };
  }
}
