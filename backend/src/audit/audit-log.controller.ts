import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';
import { ListAuditLogDto } from './dto/list-audit-log.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MANAGING_PARTNER')
@Controller('audit-log')
export class AuditLogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  private firmId(): string {
    const id = this.cls.get<string>('firmId');
    if (!id) throw new ForbiddenException('No firm context');
    return id;
  }

  @Get()
  async list(@Query() q: ListAuditLogDto) {
    const where: Prisma.AuditLogWhereInput = { firmId: this.firmId() };
    if (q.userId) where.userId = q.userId;
    if (q.action) where.action = { contains: q.action, mode: 'insensitive' };
    if (q.entityType) where.entityType = q.entityType;
    if (q.from || q.to) {
      where.createdAt = {};
      if (q.from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(q.from);
      if (q.to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(q.to);
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: q.limit,
        skip: q.offset,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, limit: q.limit, offset: q.offset };
  }
}
