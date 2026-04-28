import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientStatus, Prisma, UserRole } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsQueryDto } from './dto/list-clients.dto';

const STAFF_ROLES_RESTRICTED: UserRole[] = ['SENIOR_ARTICLE', 'ARTICLE', 'ACCOUNTANT'];

@Injectable()
export class ClientsService {
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

  /** Build the row-scope filter based on caller's role + branch + assignment. */
  private async scopeFilter(): Promise<Prisma.ClientWhereInput> {
    const role = this.role();
    const userId = this.userId();
    const firmId = this.firmId();

    if (role === 'MANAGING_PARTNER' || role === 'PARTNER') {
      return { firmId };
    }
    if (role === 'BRANCH_HEAD') {
      const me = await this.prisma.user.findUnique({ where: { id: userId } });
      return { firmId, branchId: me?.branchId ?? '__none__' };
    }
    // SENIOR_ARTICLE, ARTICLE, ACCOUNTANT — only assigned clients
    return { firmId, assignedUserId: userId };
  }

  // ────────────────────────────────────────────────────────────────────
  // Create
  // ────────────────────────────────────────────────────────────────────

  async create(dto: CreateClientDto) {
    const firmId = this.firmId();

    // Verify branch belongs to this firm (defense-in-depth, RLS would catch
    // anyway but better error message).
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, firmId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    if (dto.assignedUserId) {
      const user = await this.prisma.user.findFirst({
        where: { id: dto.assignedUserId, firmId },
      });
      if (!user) throw new NotFoundException('Assigned user not found');
    }

    const aadharMasked = dto.aadhaarLast4 ? `XXXX-XXXX-${dto.aadhaarLast4}` : undefined;

    return this.prisma.$transaction(async (tx) => {
      const max = await tx.client.aggregate({
        _max: { srNo: true },
        where: { firmId },
      });
      const srNo = (max._max.srNo ?? 0) + 1;

      try {
        const client = await tx.client.create({
          data: {
            firmId,
            branchId: dto.branchId,
            assignedUserId: dto.assignedUserId,
            srNo,
            name: dto.name,
            fatherName: dto.fatherName,
            pan: dto.pan,
            aadharMasked,
            dob: dto.dob ? new Date(dto.dob) : undefined,
            typeOfAssessee: dto.typeOfAssessee,
            email: dto.email,
            mobile: dto.mobile,
            address: dto.address,
            notes: dto.notes,
          },
        });

        await this.audit.log({
          action: 'CREATE',
          entityType: 'client',
          entityId: client.id,
          payload: { name: client.name, pan: client.pan, srNo: client.srNo },
        });

        return client;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const target = (e.meta?.target as string[] | undefined)?.join(',') ?? '';
          if (target.includes('pan')) {
            throw new ConflictException('A client with this PAN already exists in your firm');
          }
        }
        throw e;
      }
    });
  }

  // ────────────────────────────────────────────────────────────────────
  // Read
  // ────────────────────────────────────────────────────────────────────

  async findAll(query: ListClientsQueryDto) {
    const where: Prisma.ClientWhereInput = await this.scopeFilter();

    if (query.status) where.status = query.status;
    if (query.typeOfAssessee) where.typeOfAssessee = query.typeOfAssessee;
    if (query.branchId) where.branchId = query.branchId;
    if (query.assignedUserId) where.assignedUserId = query.assignedUserId;
    if (query.q) {
      const q = query.q.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { pan: { contains: q.toUpperCase() } },
        { email: { contains: q, mode: 'insensitive' } },
        { mobile: { contains: q } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        orderBy: [{ srNo: 'desc' }],
        take: query.limit,
        skip: query.offset,
        include: {
          branch: { select: { id: true, name: true, city: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    return { items, total, limit: query.limit, offset: query.offset };
  }

  async findOne(id: string) {
    const scope = await this.scopeFilter();
    const client = await this.prisma.client.findFirst({
      where: { ...scope, id },
      include: {
        branch: { select: { id: true, name: true, city: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        credentials: {
          select: {
            id: true,
            portal: true,
            username: true,
            lastUpdated: true,
            lastRevealedAt: true,
          },
        },
      },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  // ────────────────────────────────────────────────────────────────────
  // Update
  // ────────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateClientDto) {
    const role = this.role();
    if (STAFF_ROLES_RESTRICTED.includes(role)) {
      // Lower roles can only update data fields, not status / branch / assignee
      if (dto.status || dto.branchId || dto.assignedUserId) {
        throw new ForbiddenException(
          'Only Managing Partner, Partner, Branch Head, or Senior Article can change branch / assignee / status',
        );
      }
    }

    const existing = await this.findOne(id); // throws if not in scope
    const firmId = this.firmId();

    if (dto.branchId && dto.branchId !== existing.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, firmId },
      });
      if (!branch) throw new NotFoundException('Branch not found');
    }

    if (dto.assignedUserId) {
      const user = await this.prisma.user.findFirst({
        where: { id: dto.assignedUserId, firmId },
      });
      if (!user) throw new NotFoundException('Assigned user not found');
    }

    const aadharMasked =
      dto.aadhaarLast4 !== undefined
        ? dto.aadhaarLast4
          ? `XXXX-XXXX-${dto.aadhaarLast4}`
          : null
        : undefined;

    const updated = await this.prisma.client.update({
      where: { id },
      data: {
        branchId: dto.branchId,
        assignedUserId: dto.assignedUserId,
        name: dto.name,
        fatherName: dto.fatherName,
        pan: dto.pan,
        aadharMasked: aadharMasked as string | null | undefined,
        dob: dto.dob ? new Date(dto.dob) : undefined,
        typeOfAssessee: dto.typeOfAssessee,
        email: dto.email,
        mobile: dto.mobile,
        address: dto.address,
        notes: dto.notes,
        status: dto.status,
      },
    });

    await this.audit.log({
      action: 'UPDATE',
      entityType: 'client',
      entityId: id,
      payload: this.diffPayload(existing, updated),
    });

    return updated;
  }

  // ────────────────────────────────────────────────────────────────────
  // Archive
  // ────────────────────────────────────────────────────────────────────

  async archive(id: string) {
    const existing = await this.findOne(id);
    if (existing.status === ClientStatus.ARCHIVED) return existing;

    const updated = await this.prisma.client.update({
      where: { id },
      data: { status: ClientStatus.ARCHIVED },
    });
    await this.audit.log({
      action: 'ARCHIVE',
      entityType: 'client',
      entityId: id,
    });
    return updated;
  }

  // ────────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────────

  private diffPayload(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): Record<string, { from: unknown; to: unknown }> {
    const diff: Record<string, { from: unknown; to: unknown }> = {};
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const k of keys) {
      if (k === 'updatedAt' || k === 'createdAt') continue;
      const a = before[k];
      const b = after[k];
      const sameDate =
        a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
      if (a !== b && !sameDate && JSON.stringify(a) !== JSON.stringify(b)) {
        diff[k] = { from: a, to: b };
      }
    }
    return diff;
  }
}
