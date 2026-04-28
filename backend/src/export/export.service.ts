import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExportService {
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

  private toBuffer(rows: Record<string, unknown>[], sheetName: string): Buffer {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  async exportClients(): Promise<{ buffer: Buffer; filename: string }> {
    const where = await this.clientScope();
    const clients = await this.prisma.client.findMany({
      where,
      orderBy: { srNo: 'asc' },
      include: {
        branch: { select: { name: true } },
        assignedTo: { select: { name: true, email: true } },
      },
    });

    const rows = clients.map((c) => ({
      'Sr No': c.srNo,
      Name: c.name,
      'Father Name': c.fatherName ?? '',
      PAN: c.pan ?? '',
      Aadhaar: c.aadharMasked ?? '',
      DOB: c.dob ? c.dob.toISOString().slice(0, 10) : '',
      Type: c.typeOfAssessee,
      Email: c.email ?? '',
      Mobile: c.mobile ?? '',
      Address: c.address ?? '',
      Branch: c.branch.name,
      'Assigned To': c.assignedTo?.name ?? '',
      Status: c.status,
      'Onboarded On': c.onboardedOn.toISOString().slice(0, 10),
      Notes: c.notes ?? '',
    }));

    const today = new Date().toISOString().slice(0, 10);
    return {
      buffer: this.toBuffer(rows, 'Clients'),
      filename: `ca360-clients-${today}.xlsx`,
    };
  }

  async exportFilings(): Promise<{ buffer: Buffer; filename: string }> {
    const cs = await this.clientScope();
    const filings = await this.prisma.itrFiling.findMany({
      where: { client: cs },
      orderBy: [{ assessmentYear: 'desc' }, { client: { srNo: 'asc' } }],
      omit: { sourceJson: true, details: true },
      include: {
        client: { select: { srNo: true, name: true, pan: true } },
        preparedBy: { select: { name: true } },
        filedBy: { select: { name: true } },
      },
    });

    const rows = filings.map((f) => ({
      'Sr No': f.client.srNo,
      'Client Name': f.client.name,
      PAN: f.client.pan ?? '',
      'Assessment Year': f.assessmentYear,
      'ITR Form': f.itrForm ?? '',
      Status: f.status,
      'Due Date': f.dueDate ? f.dueDate.toISOString().slice(0, 10) : '',
      'Filed Date': f.filedDate ? f.filedDate.toISOString().slice(0, 10) : '',
      'Acknowledgement No': f.acknowledgementNo ?? '',
      'Gross Income (₹)': f.grossIncome ? f.grossIncome.toString() : '',
      'Tax Paid (₹)': f.taxPaid ? f.taxPaid.toString() : '',
      'Refund (₹)': f.refundAmount ? f.refundAmount.toString() : '',
      'Prepared By': f.preparedBy?.name ?? '',
      'Filed By': f.filedBy?.name ?? '',
      Remarks: f.remarks ?? '',
    }));

    const today = new Date().toISOString().slice(0, 10);
    return {
      buffer: this.toBuffer(rows, 'ITR Filings'),
      filename: `ca360-filings-${today}.xlsx`,
    };
  }

  async exportAuditLog(): Promise<{ buffer: Buffer; filename: string }> {
    // Only Managing Partner can export the full audit log
    if (this.role() !== 'MANAGING_PARTNER') {
      throw new ForbiddenException('Only Managing Partner can export the audit log');
    }
    const firmId = this.firmId();

    const logs = await this.prisma.auditLog.findMany({
      where: { firmId },
      orderBy: { createdAt: 'desc' },
      take: 10000, // safety cap
      include: { user: { select: { name: true, email: true } } },
    });

    const rows = logs.map((l) => ({
      Timestamp: l.createdAt.toISOString().replace('T', ' ').slice(0, 19),
      User: l.user?.name ?? 'system',
      Email: l.user?.email ?? '',
      Action: l.action,
      Entity: l.entityType,
      'Entity ID': l.entityId ?? '',
      IP: l.ipAddress ?? '',
      Details: l.payloadJson ? JSON.stringify(l.payloadJson) : '',
    }));

    const today = new Date().toISOString().slice(0, 10);
    return {
      buffer: this.toBuffer(rows, 'Audit Log'),
      filename: `ca360-audit-${today}.xlsx`,
    };
  }
}
