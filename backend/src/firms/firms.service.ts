import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateFirmDto } from './dto/update-firm.dto';

const ACCEPTED_LOGO_MIMES = new Set([
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'image/webp',
]);
const MAX_LOGO_BYTES = 500 * 1024; // 500 KB

@Injectable()
export class FirmsService {
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

  async getMine() {
    const firm = await this.prisma.caFirm.findUnique({
      where: { id: this.firmId() },
      select: {
        id: true,
        name: true,
        pan: true,
        registrationNo: true,
        address: true,
        plan: true,
        logoDataUrl: true,
        createdAt: true,
      },
    });
    if (!firm) throw new NotFoundException();
    return firm;
  }

  async update(dto: UpdateFirmDto) {
    const firmId = this.firmId();
    const before = await this.prisma.caFirm.findUnique({ where: { id: firmId } });
    const updated = await this.prisma.caFirm.update({
      where: { id: firmId },
      data: {
        name: dto.name?.trim(),
        pan: dto.pan?.trim().toUpperCase(),
        registrationNo: dto.registrationNo?.trim(),
        address: dto.address,
      },
      select: {
        id: true,
        name: true,
        pan: true,
        registrationNo: true,
        address: true,
        plan: true,
        logoDataUrl: true,
      },
    });
    await this.audit.log({
      action: 'UPDATE_FIRM',
      entityType: 'ca_firm',
      entityId: firmId,
      payload: { before: { name: before?.name }, after: { name: updated.name } },
    });
    return updated;
  }

  async uploadLogo(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (file.size > MAX_LOGO_BYTES) {
      throw new BadRequestException(
        `Logo must be ${MAX_LOGO_BYTES / 1024} KB or smaller. Resize/compress and try again.`,
      );
    }
    const mime = file.mimetype || '';
    if (!ACCEPTED_LOGO_MIMES.has(mime)) {
      throw new BadRequestException(
        `Unsupported logo type "${mime}". Allowed: SVG, PNG, JPG, WebP.`,
      );
    }
    const dataUrl = `data:${mime};base64,${file.buffer.toString('base64')}`;
    const firmId = this.firmId();
    await this.prisma.caFirm.update({
      where: { id: firmId },
      data: { logoDataUrl: dataUrl },
    });
    await this.audit.log({
      action: 'UPLOAD_LOGO',
      entityType: 'ca_firm',
      entityId: firmId,
      payload: { filename: file.originalname, size: file.size, mime },
    });
    return { logoDataUrl: dataUrl };
  }

  async clearLogo() {
    const firmId = this.firmId();
    await this.prisma.caFirm.update({
      where: { id: firmId },
      data: { logoDataUrl: null },
    });
    await this.audit.log({
      action: 'CLEAR_LOGO',
      entityType: 'ca_firm',
      entityId: firmId,
    });
    return { ok: true };
  }
}
