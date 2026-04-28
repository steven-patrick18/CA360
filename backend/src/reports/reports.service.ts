import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';

const PENDING_STATUSES = ['PENDING', 'DOCS_AWAITED', 'IN_PROCESS', 'READY'] as const;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
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

  /** Same scope as ClientsService — keeps report visibility consistent. */
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

  // ─── Filings summary: AY × status grid + totals ───────────────────────
  async filingsSummary() {
    const cs = await this.clientScope();
    const csActive: Prisma.ClientWhereInput = { ...cs, status: 'ACTIVE' };

    const grid = await this.prisma.itrFiling.groupBy({
      by: ['assessmentYear', 'status'],
      where: { client: csActive },
      _count: { _all: true },
      _sum: { refundAmount: true, taxPaid: true, grossIncome: true },
    });

    return grid.map((row) => ({
      assessmentYear: row.assessmentYear,
      status: row.status,
      count: row._count._all,
      refundAmount: row._sum.refundAmount?.toString() ?? null,
      taxPaid: row._sum.taxPaid?.toString() ?? null,
      grossIncome: row._sum.grossIncome?.toString() ?? null,
    }));
  }

  // ─── Workload by staff: assigned clients + pending filings per user ───
  async workloadByStaff() {
    const cs = await this.clientScope();
    const firmId = this.firmId();

    // Active staff in scope
    const staff = await this.prisma.user.findMany({
      where: { firmId, isActive: true },
      select: { id: true, name: true, email: true, role: true, branchId: true },
    });

    const clientsByUser = await this.prisma.client.groupBy({
      by: ['assignedUserId'],
      where: { ...cs, status: 'ACTIVE' },
      _count: { _all: true },
    });
    const clientCount = new Map<string, number>();
    for (const r of clientsByUser) {
      if (r.assignedUserId) clientCount.set(r.assignedUserId, r._count._all);
    }

    const pendingByPreparer = await this.prisma.itrFiling.groupBy({
      by: ['preparedById'],
      where: {
        client: { ...cs, status: 'ACTIVE' },
        status: { in: [...PENDING_STATUSES] },
      },
      _count: { _all: true },
    });
    const pendingCount = new Map<string, number>();
    for (const r of pendingByPreparer) {
      if (r.preparedById) pendingCount.set(r.preparedById, r._count._all);
    }

    return staff.map((s) => ({
      ...s,
      assignedClients: clientCount.get(s.id) ?? 0,
      pendingFilingsAsPreparer: pendingCount.get(s.id) ?? 0,
    }));
  }

  // ─── Workload by branch: clients + pending filings per branch ─────────
  async workloadByBranch() {
    const cs = await this.clientScope();
    const firmId = this.firmId();

    const branches = await this.prisma.branch.findMany({
      where: { firmId },
      select: { id: true, name: true, city: true, isHq: true },
      orderBy: [{ isHq: 'desc' }, { name: 'asc' }],
    });

    const clientsByBranch = await this.prisma.client.groupBy({
      by: ['branchId'],
      where: { ...cs, status: 'ACTIVE' },
      _count: { _all: true },
    });
    const clientCount = new Map<string, number>();
    for (const r of clientsByBranch) clientCount.set(r.branchId, r._count._all);

    const filingsByBranch = await this.prisma.$queryRaw<Array<{ branch_id: string; count: bigint }>>`
      SELECT c."branch_id", COUNT(f.id) as count
      FROM "itr_filings" f
      JOIN "clients" c ON c.id = f."client_id"
      WHERE c."firm_id" = ${firmId}::uuid
        AND c."status" = 'ACTIVE'
        AND f."status" IN ('PENDING','DOCS_AWAITED','IN_PROCESS','READY')
      GROUP BY c."branch_id"
    `;
    const pendingCount = new Map<string, number>();
    for (const r of filingsByBranch) pendingCount.set(r.branch_id, Number(r.count));

    return branches.map((b) => ({
      ...b,
      activeClients: clientCount.get(b.id) ?? 0,
      pendingFilings: pendingCount.get(b.id) ?? 0,
    }));
  }

  // ─── Upcoming filings (due in next N days, not yet filed) ─────────────
  async upcomingDue(daysAhead: number = 30) {
    const cs = await this.clientScope();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + daysAhead);

    return this.prisma.itrFiling.findMany({
      where: {
        client: { ...cs, status: 'ACTIVE' },
        status: { in: [...PENDING_STATUSES] },
        dueDate: { gte: today, lte: horizon },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        client: { select: { id: true, srNo: true, name: true, pan: true } },
        preparedBy: { select: { id: true, name: true } },
      },
    });
  }

  // ─── Overdue filings (past dueDate, not yet filed) ────────────────────
  async overdue() {
    const cs = await this.clientScope();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.prisma.itrFiling.findMany({
      where: {
        client: { ...cs, status: 'ACTIVE' },
        status: { in: [...PENDING_STATUSES] },
        dueDate: { lt: today },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        client: { select: { id: true, srNo: true, name: true, pan: true } },
        preparedBy: { select: { id: true, name: true } },
      },
    });
  }
}
