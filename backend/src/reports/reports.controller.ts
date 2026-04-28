import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('filings-summary')
  filingsSummary() {
    return this.reports.filingsSummary();
  }

  @Get('workload-by-staff')
  workloadByStaff() {
    return this.reports.workloadByStaff();
  }

  @Get('workload-by-branch')
  workloadByBranch() {
    return this.reports.workloadByBranch();
  }

  @Get('upcoming-due')
  upcomingDue(@Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number) {
    return this.reports.upcomingDue(days);
  }

  @Get('overdue')
  overdue() {
    return this.reports.overdue();
  }
}
