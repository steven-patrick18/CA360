import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateComputationDto } from './dto/computation-payload.dto';
import { UpdateComputationDto } from './dto/update-computation.dto';
import { ListComputationsQueryDto } from './dto/list-computations.dto';

@Injectable()
export class ComputationsService {
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

  private userId(): string {
    const id = this.cls.get<string>('userId');
    if (!id) throw new ForbiddenException('No user context');
    return id;
  }

  private role(): UserRole {
    const r = this.cls.get<UserRole>('userRole');
    if (!r) throw new ForbiddenException('No role context');
    return r;
  }

  /** Same client-scope rules as Filings: Articles see only their assigned clients. */
  private async clientScope(): Promise<Prisma.ClientWhereInput> {
    const role = this.role();
    const userId = this.userId();
    const firmId = this.firmId();

    if (role === 'MANAGING_PARTNER' || role === 'PARTNER') return { firmId };
    if (role === 'BRANCH_HEAD') {
      const me = await this.prisma.user.findUnique({ where: { id: userId } });
      return { firmId, branchId: me?.branchId ?? '__none__' };
    }
    return { firmId, assignedUserId: userId };
  }

  // ────────────────────────────────────────────────────────────────────
  // Create
  // ────────────────────────────────────────────────────────────────────

  async create(dto: CreateComputationDto) {
    if (dto.assessmentYear.startsWith('INVALID:')) {
      throw new BadRequestException(
        'Invalid assessment year — second part must be the next year (e.g., 2024-25, not 2024-26)',
      );
    }
    const firmId = this.firmId();
    const cs = await this.clientScope();

    const client = await this.prisma.client.findFirst({
      where: { ...cs, id: dto.clientId },
    });
    if (!client) throw new NotFoundException('Client not found or out of scope');

    const created = await this.prisma.computation.create({
      data: {
        firmId,
        clientId: dto.clientId,
        assessmentYear: dto.assessmentYear,
        regime: dto.regime,
        ageCategory: dto.ageCategory ?? 'BELOW_60',
        inputs: dto.inputs as unknown as Prisma.InputJsonValue,
        computed: dto.computed as unknown as Prisma.InputJsonValue,
        taxPayable: dto.taxPayable,
        remarks: dto.remarks,
      },
      include: {
        client: { select: { id: true, srNo: true, name: true, pan: true } },
      },
    });

    await this.audit.log({
      action: 'CREATE',
      entityType: 'computation',
      entityId: created.id,
      payload: {
        clientId: client.id,
        clientName: client.name,
        assessmentYear: created.assessmentYear,
        regime: created.regime,
        taxPayable: dto.taxPayable,
      },
    });

    return created;
  }

  // ────────────────────────────────────────────────────────────────────
  // Read
  // ────────────────────────────────────────────────────────────────────

  async findAll(query: ListComputationsQueryDto) {
    const cs = await this.clientScope();
    const where: Prisma.ComputationWhereInput = { client: cs };
    if (query.clientId) where.clientId = query.clientId;
    if (query.assessmentYear) where.assessmentYear = query.assessmentYear;
    if (query.regime) where.regime = query.regime;

    const [items, total] = await Promise.all([
      this.prisma.computation.findMany({
        where,
        orderBy: [{ assessmentYear: 'desc' }, { updatedAt: 'desc' }],
        take: query.limit,
        skip: query.offset,
        include: {
          client: { select: { id: true, srNo: true, name: true, pan: true } },
        },
      }),
      this.prisma.computation.count({ where }),
    ]);

    return { items, total, limit: query.limit, offset: query.offset };
  }

  async findOne(id: string) {
    const cs = await this.clientScope();
    const c = await this.prisma.computation.findFirst({
      where: { id, client: cs },
      include: {
        client: { select: { id: true, srNo: true, name: true, pan: true, typeOfAssessee: true } },
      },
    });
    if (!c) throw new NotFoundException('Computation not found');
    return c;
  }

  // ────────────────────────────────────────────────────────────────────
  // Update
  // ────────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateComputationDto) {
    if (dto.assessmentYear?.startsWith('INVALID:')) {
      throw new BadRequestException('Invalid assessment year format');
    }
    const existing = await this.findOne(id);

    const updated = await this.prisma.computation.update({
      where: { id },
      data: {
        assessmentYear: dto.assessmentYear,
        regime: dto.regime,
        ageCategory: dto.ageCategory,
        inputs: dto.inputs ? (dto.inputs as unknown as Prisma.InputJsonValue) : undefined,
        computed: dto.computed ? (dto.computed as unknown as Prisma.InputJsonValue) : undefined,
        taxPayable: dto.taxPayable,
        remarks: dto.remarks,
      },
      include: {
        client: { select: { id: true, srNo: true, name: true, pan: true } },
      },
    });

    await this.audit.log({
      action: 'UPDATE',
      entityType: 'computation',
      entityId: id,
      payload: {
        clientId: existing.clientId,
        assessmentYear: updated.assessmentYear,
        taxPayable: dto.taxPayable,
      },
    });

    return updated;
  }

  // ────────────────────────────────────────────────────────────────────
  // Delete
  // ────────────────────────────────────────────────────────────────────

  async remove(id: string) {
    const existing = await this.findOne(id);
    await this.prisma.computation.delete({ where: { id } });
    await this.audit.log({
      action: 'DELETE',
      entityType: 'computation',
      entityId: id,
      payload: { clientId: existing.clientId, assessmentYear: existing.assessmentYear },
    });
    return { ok: true };
  }
}
