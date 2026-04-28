import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
]);

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
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

  /** Same row scope as ClientsService — keeps junior staff confined to assigned clients. */
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

  private async assertClientInScope(clientId: string) {
    const cs = await this.clientScope();
    const client = await this.prisma.client.findFirst({
      where: { ...cs, id: clientId },
    });
    if (!client) throw new NotFoundException('Client not found or out of scope');
    return client;
  }

  async list(clientId: string, filingId?: string) {
    await this.assertClientInScope(clientId);
    return this.prisma.document.findMany({
      where: {
        clientId,
        ...(filingId ? { filingId } : {}),
      },
      orderBy: { uploadedAt: 'desc' },
      include: {
        uploadedBy: { select: { id: true, name: true } },
        filing: { select: { id: true, assessmentYear: true } },
      },
    });
  }

  async upload(
    clientId: string,
    file: Express.Multer.File,
    options: { category?: string; filingId?: string },
  ) {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(`File exceeds ${MAX_FILE_SIZE / 1024 / 1024} MB limit`);
    }
    if (file.mimetype && !ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    const client = await this.assertClientInScope(clientId);
    const firmId = this.firmId();

    if (options.filingId) {
      const filing = await this.prisma.itrFiling.findFirst({
        where: { id: options.filingId, clientId, firmId },
        select: { id: true },
      });
      if (!filing) throw new NotFoundException('Filing not found for this client');
    }

    const ext = extname(file.originalname).toLowerCase().slice(0, 16);
    const docId = randomUUID();
    const storageKey = `firm/${firmId}/client/${clientId}/${docId}${ext}`;

    await this.storage.put(storageKey, file.buffer);

    const doc = await this.prisma.document.create({
      data: {
        id: docId,
        firmId,
        clientId,
        filingId: options.filingId,
        category: options.category?.slice(0, 60),
        storagePath: storageKey,
        originalName: file.originalname,
        size: file.size,
        mime: file.mimetype || 'application/octet-stream',
        uploadedById: this.userId(),
      },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      action: 'UPLOAD_DOCUMENT',
      entityType: 'document',
      entityId: doc.id,
      payload: {
        clientId,
        clientName: client.name,
        filename: file.originalname,
        size: file.size,
      },
    });

    return doc;
  }

  async download(documentId: string): Promise<{
    buffer: Buffer;
    mime: string;
    filename: string;
  }> {
    const cs = await this.clientScope();
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, client: cs },
    });
    if (!doc) throw new NotFoundException('Document not found');

    const buffer = await this.storage.get(doc.storagePath);

    await this.audit.log({
      action: 'DOWNLOAD_DOCUMENT',
      entityType: 'document',
      entityId: doc.id,
      payload: { clientId: doc.clientId, filename: doc.originalName },
    });

    return { buffer, mime: doc.mime, filename: doc.originalName };
  }

  async remove(documentId: string) {
    const cs = await this.clientScope();
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, client: cs },
    });
    if (!doc) throw new NotFoundException('Document not found');

    // Only Managing Partner / Partner / Branch Head can delete documents.
    const role = this.role();
    if (!['MANAGING_PARTNER', 'PARTNER', 'BRANCH_HEAD'].includes(role)) {
      throw new ForbiddenException('Insufficient role to delete documents');
    }

    await this.storage.delete(doc.storagePath);
    await this.prisma.document.delete({ where: { id: doc.id } });

    await this.audit.log({
      action: 'DELETE_DOCUMENT',
      entityType: 'document',
      entityId: doc.id,
      payload: { clientId: doc.clientId, filename: doc.originalName },
    });

    return { ok: true };
  }
}
