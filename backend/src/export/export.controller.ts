import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function send(res: Response, buffer: Buffer, filename: string) {
  res
    .set({
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    })
    .send(buffer);
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('export')
export class ExportController {
  constructor(private readonly exportSvc: ExportService) {}

  @Get('clients')
  async clients(@Res() res: Response) {
    const { buffer, filename } = await this.exportSvc.exportClients();
    send(res, buffer, filename);
  }

  @Get('filings')
  async filings(@Res() res: Response) {
    const { buffer, filename } = await this.exportSvc.exportFilings();
    send(res, buffer, filename);
  }

  @Get('audit-log')
  @Roles('MANAGING_PARTNER')
  async auditLog(@Res() res: Response) {
    const { buffer, filename } = await this.exportSvc.exportAuditLog();
    send(res, buffer, filename);
  }
}
