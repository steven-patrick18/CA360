import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateFilingDto } from './dto/create-filing.dto';
import { UpdateFilingDto } from './dto/update-filing.dto';
import { ListFilingsQueryDto } from './dto/list-filings.dto';
import { parseItrJson, type ParsedItr } from './itr-json-parser';

export interface ImportItrResult {
  filing: { id: string; assessmentYear: string; status: string };
  parsed: ParsedItr;
  created: boolean; // false → an existing filing was updated
}

@Injectable()
export class FilingsService {
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

  /** Filter by *which clients* the caller can see — same logic as ClientsService. */
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

  private async filingScope(): Promise<Prisma.ItrFilingWhereInput> {
    const cs = await this.clientScope();
    return { client: cs };
  }

  // ────────────────────────────────────────────────────────────────────
  // Create
  // ────────────────────────────────────────────────────────────────────

  async create(dto: CreateFilingDto) {
    if (dto.assessmentYear.startsWith('INVALID:')) {
      throw new BadRequestException(
        'Invalid assessment year — second part must be the next year (e.g., 2024-25, not 2024-26)',
      );
    }

    const firmId = this.firmId();
    const cs = await this.clientScope();

    // Caller must have access to the client
    const client = await this.prisma.client.findFirst({
      where: { ...cs, id: dto.clientId },
    });
    if (!client) throw new NotFoundException('Client not found or out of scope');

    if (dto.preparedById) {
      const u = await this.prisma.user.findFirst({
        where: { id: dto.preparedById, firmId },
      });
      if (!u) throw new NotFoundException('preparedBy user not found');
    }
    if (dto.filedById) {
      const u = await this.prisma.user.findFirst({
        where: { id: dto.filedById, firmId },
      });
      if (!u) throw new NotFoundException('filedBy user not found');
    }

    try {
      const filing = await this.prisma.itrFiling.create({
        data: {
          firmId,
          clientId: dto.clientId,
          assessmentYear: dto.assessmentYear,
          itrForm: dto.itrForm,
          status: dto.status ?? 'PENDING',
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          filedDate: dto.filedDate ? new Date(dto.filedDate) : undefined,
          acknowledgementNo: dto.acknowledgementNo,
          grossIncome: dto.grossIncome,
          taxPaid: dto.taxPaid,
          refundAmount: dto.refundAmount,
          preparedById: dto.preparedById,
          filedById: dto.filedById,
          remarks: dto.remarks,
        },
      });

      await this.audit.log({
        action: 'CREATE',
        entityType: 'itr_filing',
        entityId: filing.id,
        payload: {
          clientId: client.id,
          clientName: client.name,
          assessmentYear: filing.assessmentYear,
          status: filing.status,
        },
      });

      return filing;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          `A filing for AY ${dto.assessmentYear} already exists for this client`,
        );
      }
      throw e;
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // Read
  // ────────────────────────────────────────────────────────────────────

  async findAll(query: ListFilingsQueryDto) {
    const where: Prisma.ItrFilingWhereInput = await this.filingScope();
    if (query.clientId) where.clientId = query.clientId;
    if (query.assessmentYear) where.assessmentYear = query.assessmentYear;
    if (query.status) where.status = query.status;
    if (query.itrForm) where.itrForm = query.itrForm;
    if (query.branchId) {
      // Combine with the existing client-scope filter
      where.client = { ...((where.client as object) ?? {}), branchId: query.branchId };
    }

    const [items, total] = await Promise.all([
      this.prisma.itrFiling.findMany({
        where,
        orderBy: [{ assessmentYear: 'desc' }, { updatedAt: 'desc' }],
        take: query.limit,
        skip: query.offset,
        include: {
          client: { select: { id: true, srNo: true, name: true, pan: true, typeOfAssessee: true } },
          preparedBy: { select: { id: true, name: true } },
          filedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.itrFiling.count({ where }),
    ]);

    return { items, total, limit: query.limit, offset: query.offset };
  }

  async findOne(id: string) {
    const scope = await this.filingScope();
    const filing = await this.prisma.itrFiling.findFirst({
      where: { ...scope, id },
      include: {
        client: {
          select: { id: true, srNo: true, name: true, pan: true, branchId: true, typeOfAssessee: true },
        },
        preparedBy: { select: { id: true, name: true } },
        filedBy: { select: { id: true, name: true } },
      },
    });
    if (!filing) throw new NotFoundException('Filing not found');
    return filing;
  }

  // ────────────────────────────────────────────────────────────────────
  // Update
  // ────────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateFilingDto) {
    if (dto.assessmentYear?.startsWith('INVALID:')) {
      throw new BadRequestException('Invalid assessment year format');
    }

    const existing = await this.findOne(id);
    const firmId = this.firmId();

    if (dto.preparedById) {
      const u = await this.prisma.user.findFirst({
        where: { id: dto.preparedById, firmId },
      });
      if (!u) throw new NotFoundException('preparedBy user not found');
    }
    if (dto.filedById) {
      const u = await this.prisma.user.findFirst({
        where: { id: dto.filedById, firmId },
      });
      if (!u) throw new NotFoundException('filedBy user not found');
    }

    const updated = await this.prisma.itrFiling.update({
      where: { id },
      data: {
        assessmentYear: dto.assessmentYear,
        itrForm: dto.itrForm,
        status: dto.status,
        dueDate: dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate) : null) : undefined,
        filedDate:
          dto.filedDate !== undefined ? (dto.filedDate ? new Date(dto.filedDate) : null) : undefined,
        acknowledgementNo: dto.acknowledgementNo,
        grossIncome: dto.grossIncome,
        taxPaid: dto.taxPaid,
        refundAmount: dto.refundAmount,
        preparedById: dto.preparedById,
        filedById: dto.filedById,
        remarks: dto.remarks,
      },
    });

    const statusChanged = dto.status && dto.status !== existing.status;
    await this.audit.log({
      action: statusChanged ? `STATUS_CHANGE_${dto.status}` : 'UPDATE',
      entityType: 'itr_filing',
      entityId: id,
      payload: {
        clientId: existing.clientId,
        assessmentYear: updated.assessmentYear,
        ...(statusChanged ? { from: existing.status, to: dto.status } : {}),
      },
    });

    return updated;
  }

  // ────────────────────────────────────────────────────────────────────
  // Delete
  // ────────────────────────────────────────────────────────────────────

  async remove(id: string) {
    const existing = await this.findOne(id);
    if (existing.status === 'ACKNOWLEDGED' || existing.status === 'FILED') {
      throw new ForbiddenException(
        'Cannot delete a filing that has been filed or acknowledged. Mark it DEFECTIVE if needed.',
      );
    }
    await this.prisma.itrFiling.delete({ where: { id } });
    await this.audit.log({
      action: 'DELETE',
      entityType: 'itr_filing',
      entityId: id,
      payload: { clientId: existing.clientId, assessmentYear: existing.assessmentYear },
    });
    return { ok: true };
  }

  // ────────────────────────────────────────────────────────────────────
  // Import from ITR JSON (downloaded by the user from the e-Filing portal)
  // ────────────────────────────────────────────────────────────────────

  async importFromJson(clientId: string, fileBuffer: Buffer): Promise<ImportItrResult> {
    const firmId = this.firmId();
    const cs = await this.clientScope();

    const client = await this.prisma.client.findFirst({
      where: { ...cs, id: clientId },
    });
    if (!client) throw new NotFoundException('Client not found or out of scope');

    let json: unknown;
    try {
      json = JSON.parse(fileBuffer.toString('utf8'));
    } catch (e) {
      throw new BadRequestException(
        `Could not parse the file as JSON: ${(e as Error).message}`,
      );
    }

    let parsed: ParsedItr;
    try {
      parsed = parseItrJson(json);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    // Sanity: PAN in the file must match the client we're importing into.
    if (client.pan && parsed.pan !== client.pan.toUpperCase()) {
      throw new BadRequestException(
        `PAN mismatch — file is for ${parsed.pan}, this client is ${client.pan}. ` +
          `Make sure you're uploading to the right client.`,
      );
    }

    // If the filing was actually filed (we have an ack number), bump status to
    // FILED unless we already moved past that.
    const existingFiling = await this.prisma.itrFiling.findUnique({
      where: { clientId_assessmentYear: { clientId, assessmentYear: parsed.assessmentYear } },
    });

    const statusFromImport = parsed.acknowledgementNo
      ? existingFiling?.status === 'ACKNOWLEDGED'
        ? 'ACKNOWLEDGED'
        : 'FILED'
      : existingFiling?.status ?? 'IN_PROCESS';

    const data = {
      itrForm: parsed.itrForm ?? existingFiling?.itrForm,
      status: statusFromImport,
      filedDate: parsed.filedDate ? new Date(parsed.filedDate) : existingFiling?.filedDate,
      acknowledgementNo: parsed.acknowledgementNo ?? existingFiling?.acknowledgementNo,
      grossIncome: parsed.grossIncome ?? existingFiling?.grossIncome,
      taxPaid: parsed.taxPaid ?? existingFiling?.taxPaid,
      refundAmount: parsed.refundAmount ?? existingFiling?.refundAmount,
    };

    const filing = await this.prisma.itrFiling.upsert({
      where: { clientId_assessmentYear: { clientId, assessmentYear: parsed.assessmentYear } },
      create: {
        firmId,
        clientId,
        assessmentYear: parsed.assessmentYear,
        ...data,
      },
      update: data,
    });

    await this.audit.log({
      action: existingFiling ? 'IMPORT_UPDATE' : 'IMPORT_CREATE',
      entityType: 'itr_filing',
      entityId: filing.id,
      payload: {
        clientId,
        assessmentYear: parsed.assessmentYear,
        itrForm: parsed.itrForm,
        ack: parsed.acknowledgementNo,
        notes: parsed.notes,
      },
    });

    return {
      filing: {
        id: filing.id,
        assessmentYear: filing.assessmentYear,
        status: filing.status,
      },
      parsed,
      created: !existingFiling,
    };
  }
}
