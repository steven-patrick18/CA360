import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Read-only metadata endpoints for populating frontend dropdowns
 * (branches, staff, etc.). No mutations live here.
 */
@UseGuards(JwtAuthGuard)
@Controller('meta')
export class MetaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  private firmId(): string {
    const id = this.cls.get<string>('firmId');
    if (!id) throw new ForbiddenException('No firm context');
    return id;
  }

  @Get('branches')
  branches() {
    return this.prisma.branch.findMany({
      where: { firmId: this.firmId() },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, city: true, isHq: true },
    });
  }

  @Get('staff')
  staff() {
    return this.prisma.user.findMany({
      where: { firmId: this.firmId(), isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, role: true, branchId: true },
    });
  }
}
