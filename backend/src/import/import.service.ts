import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClientType, Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR4_REGEX = /^[0-9]{4}$/;

const TYPE_SYNONYMS: Record<string, ClientType> = {
  individual: ClientType.INDIVIDUAL,
  individuals: ClientType.INDIVIDUAL,
  ind: ClientType.INDIVIDUAL,
  huf: ClientType.HUF,
  proprietorship: ClientType.PROPRIETORSHIP,
  prop: ClientType.PROPRIETORSHIP,
  partnership: ClientType.PARTNERSHIP,
  firm: ClientType.PARTNERSHIP,
  llp: ClientType.LLP,
  company: ClientType.COMPANY,
  pvt: ClientType.COMPANY,
  'private limited': ClientType.COMPANY,
  trust: ClientType.TRUST,
  aop: ClientType.AOP_BOI,
  boi: ClientType.AOP_BOI,
  'aop/boi': ClientType.AOP_BOI,
  'aop-boi': ClientType.AOP_BOI,
  other: ClientType.OTHER,
};

export interface RowError {
  row: number;
  message: string;
  data?: Record<string, unknown>;
}

export interface ImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: RowError[];
  createdIds: string[];
}

function pickKey(obj: Record<string, unknown>, ...names: string[]): unknown {
  const lower = Object.keys(obj).reduce<Record<string, string>>((acc, k) => {
    acc[k.toLowerCase().replace(/[\s_-]+/g, '')] = k;
    return acc;
  }, {});
  for (const n of names) {
    const k = lower[n.toLowerCase().replace(/[\s_-]+/g, '')];
    if (k && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

function asString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length === 0 ? undefined : s;
}

function asDate(v: unknown): Date | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (v instanceof Date) return v;
  if (typeof v === 'number') {
    // Excel serial date (days since 1899-12-30)
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + v * 86400000);
  }
  const s = String(v).trim();
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

@Injectable()
export class ImportService {
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

  async importClients(buffer: Buffer): Promise<ImportResult> {
    const firmId = this.firmId();

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch (e) {
      throw new NotFoundException(`Could not read XLSX: ${(e as Error).message}`);
    }
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new NotFoundException('No sheets found in workbook');
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    // Resolve default branch (HQ if not specified per row)
    const branches = await this.prisma.branch.findMany({ where: { firmId } });
    const hqBranch = branches.find((b) => b.isHq) ?? branches[0];
    if (!hqBranch) {
      throw new NotFoundException('No branches exist — create a branch before importing.');
    }
    const branchByName = new Map(branches.map((b) => [b.name.toLowerCase(), b]));

    const users = await this.prisma.user.findMany({ where: { firmId } });
    const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
    const userByName = new Map(users.map((u) => [u.name.toLowerCase(), u]));

    const errors: RowError[] = [];
    const createdIds: string[] = [];
    let successCount = 0;

    // Need a starting srNo — read max once, increment per row
    const maxAgg = await this.prisma.client.aggregate({
      _max: { srNo: true },
      where: { firmId },
    });
    let nextSrNo = (maxAgg._max.srNo ?? 0) + 1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +1 for header, +1 for 1-indexed

      try {
        const name = asString(pickKey(row, 'name', 'clientname', 'client name'));
        if (!name) {
          errors.push({ row: rowNum, message: 'Missing required field: Name', data: row });
          continue;
        }

        const pan = asString(pickKey(row, 'pan'))?.toUpperCase();
        if (pan && !PAN_REGEX.test(pan)) {
          errors.push({ row: rowNum, message: `Invalid PAN format: ${pan}`, data: row });
          continue;
        }

        const aadhaarRaw = asString(pickKey(row, 'aadhaar', 'aadhar', 'aadhaarlast4', 'aadhar last 4'));
        let aadhaarLast4: string | undefined;
        if (aadhaarRaw) {
          // Accept full 12-digit or last 4
          const digits = aadhaarRaw.replace(/\D/g, '');
          if (digits.length === 12) aadhaarLast4 = digits.slice(-4);
          else if (digits.length === 4) aadhaarLast4 = digits;
          else {
            errors.push({ row: rowNum, message: 'Aadhaar must be 4 or 12 digits', data: row });
            continue;
          }
          if (!AADHAAR4_REGEX.test(aadhaarLast4)) {
            errors.push({ row: rowNum, message: 'Invalid Aadhaar', data: row });
            continue;
          }
        }

        const typeRaw = asString(pickKey(row, 'type', 'type of assessee', 'typeofassessee', 'category'));
        const typeOfAssessee: ClientType = typeRaw
          ? (TYPE_SYNONYMS[typeRaw.toLowerCase()] ?? ClientType.INDIVIDUAL)
          : ClientType.INDIVIDUAL;

        const branchName = asString(pickKey(row, 'branch'));
        const branch = branchName
          ? branchByName.get(branchName.toLowerCase()) ?? hqBranch
          : hqBranch;

        const assigneeRaw = asString(pickKey(row, 'assignedto', 'assigned to', 'assignee'));
        const assignee = assigneeRaw
          ? userByEmail.get(assigneeRaw.toLowerCase()) ??
            userByName.get(assigneeRaw.toLowerCase())
          : undefined;

        const email = asString(pickKey(row, 'email', 'emailid', 'email id'));
        const mobile = asString(pickKey(row, 'mobile', 'phone', 'contact'));
        const fatherName = asString(pickKey(row, 'fathername', "father'sname", 'father name'));
        const dob = asDate(pickKey(row, 'dob', 'dateofbirth', 'date of birth'));
        const address = asString(pickKey(row, 'address'));
        const notes = asString(pickKey(row, 'notes', 'remarks'));

        try {
          const created = await this.prisma.client.create({
            data: {
              firmId,
              branchId: branch.id,
              assignedUserId: assignee?.id,
              srNo: nextSrNo,
              name,
              pan,
              aadharMasked: aadhaarLast4 ? `XXXX-XXXX-${aadhaarLast4}` : undefined,
              fatherName,
              dob,
              typeOfAssessee,
              email,
              mobile,
              address,
              notes,
            },
          });
          createdIds.push(created.id);
          successCount++;
          nextSrNo++;
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            const target = (e.meta?.target as string[] | undefined)?.join(',') ?? '';
            if (target.includes('pan')) {
              errors.push({ row: rowNum, message: `Duplicate PAN ${pan}`, data: row });
              continue;
            }
            if (target.includes('sr_no')) {
              // Race — retry with next number
              nextSrNo++;
              i--; // retry this row
              continue;
            }
          }
          errors.push({
            row: rowNum,
            message: `Insert failed: ${(e as Error).message}`,
            data: row,
          });
        }
      } catch (e) {
        errors.push({ row: rowNum, message: (e as Error).message, data: row });
      }
    }

    await this.audit.log({
      action: 'IMPORT_CLIENTS',
      entityType: 'client',
      payload: {
        totalRows: rows.length,
        successCount,
        errorCount: errors.length,
      },
    });

    return {
      totalRows: rows.length,
      successCount,
      errorCount: errors.length,
      errors: errors.slice(0, 100), // cap returned errors
      createdIds,
    };
  }
}
