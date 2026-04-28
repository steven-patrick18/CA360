import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const PENDING_STATUSES = ['PENDING', 'DOCS_AWAITED', 'IN_PROCESS', 'READY'] as const;

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
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

  /** Same client-scope logic as ClientsService — kept inline to avoid circular dep. */
  private async clientScope(): Promise<Prisma.ClientWhereInput> {
    const role = this.role();
    const firmId = this.firmId();
    const userId = this.userId();

    if (role === 'MANAGING_PARTNER' || role === 'PARTNER') return { firmId };
    if (role === 'BRANCH_HEAD') {
      const me = await this.prisma.user.findUnique({ where: { id: userId } });
      return { firmId, branchId: me?.branchId ?? '__none__' };
    }
    return { firmId, assignedUserId: userId };
  }

  @Get('stats')
  async stats() {
    const cs = await this.clientScope();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [activeClients, totalClients, pendingFilings, filedThisMonth] = await Promise.all([
      this.prisma.client.count({ where: { ...cs, status: 'ACTIVE' } }),
      this.prisma.client.count({ where: cs }),
      this.prisma.itrFiling.count({
        where: {
          client: cs,
          status: { in: [...PENDING_STATUSES] },
        },
      }),
      this.prisma.itrFiling.count({
        where: {
          client: cs,
          filedDate: { gte: monthStart, lt: monthEnd },
        },
      }),
    ]);

    // Status breakdown for pending pipeline visualization
    const pipeline = await this.prisma.itrFiling.groupBy({
      by: ['status'],
      where: { client: cs },
      _count: { _all: true },
    });

    // Client type breakdown — shown as clickable cards on the dashboard
    const clientTypeRows = await this.prisma.client.groupBy({
      by: ['typeOfAssessee'],
      where: cs,
      _count: { _all: true },
    });

    return {
      activeClients,
      totalClients,
      pendingFilings,
      filedThisMonth,
      pipeline: pipeline.reduce(
        (acc, row) => {
          acc[row.status] = row._count._all;
          return acc;
        },
        {} as Record<string, number>,
      ),
      clientTypeBreakdown: clientTypeRows.reduce(
        (acc, row) => {
          acc[row.typeOfAssessee] = row._count._all;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}
