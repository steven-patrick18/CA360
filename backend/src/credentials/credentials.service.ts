import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Portal } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EncryptionService } from '../encryption/encryption.service';
import { UpsertCredentialDto } from './dto/upsert-credential.dto';

@Injectable()
export class CredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly audit: AuditService,
    private readonly enc: EncryptionService,
  ) {}

  private firmId() {
    const id = this.cls.get<string>('firmId');
    if (!id) throw new ForbiddenException('No firm context');
    return id;
  }

  private userId() {
    return this.cls.get<string>('userId') ?? null;
  }

  private async assertClientInScope(clientId: string) {
    const firmId = this.firmId();
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, firmId },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async list(clientId: string) {
    await this.assertClientInScope(clientId);
    return this.prisma.clientCredential.findMany({
      where: { clientId },
      select: {
        id: true,
        portal: true,
        username: true,
        lastUpdated: true,
        lastRevealedAt: true,
        revealedBy: { select: { id: true, name: true } },
      },
    });
  }

  async upsert(clientId: string, dto: UpsertCredentialDto) {
    const client = await this.assertClientInScope(clientId);
    const firmId = this.firmId();

    const encrypted = this.enc.encryptForFirm(firmId, dto.password);

    const result = await this.prisma.clientCredential.upsert({
      where: { clientId_portal: { clientId, portal: dto.portal } },
      create: {
        firmId,
        clientId,
        portal: dto.portal,
        username: dto.username,
        encryptedPassword: encrypted,
        encryptionKeyVersion: 1,
      },
      update: {
        username: dto.username,
        encryptedPassword: encrypted,
        encryptionKeyVersion: 1,
        lastUpdated: new Date(),
      },
    });

    await this.audit.log({
      action: 'UPSERT_CREDENTIAL',
      entityType: 'client_credential',
      entityId: result.id,
      payload: { clientId, clientName: client.name, portal: dto.portal },
    });

    return {
      id: result.id,
      portal: result.portal,
      username: result.username,
      lastUpdated: result.lastUpdated,
    };
  }

  async reveal(clientId: string, portal: Portal) {
    const client = await this.assertClientInScope(clientId);
    const firmId = this.firmId();

    const cred = await this.prisma.clientCredential.findUnique({
      where: { clientId_portal: { clientId, portal } },
    });
    if (!cred) throw new NotFoundException('Credential not found');

    const plaintext = this.enc.decryptForFirm(firmId, cred.encryptedPassword);

    await this.prisma.clientCredential.update({
      where: { id: cred.id },
      data: {
        lastRevealedAt: new Date(),
        lastRevealedBy: this.userId(),
      },
    });

    await this.audit.log({
      action: 'REVEAL_CREDENTIAL',
      entityType: 'client_credential',
      entityId: cred.id,
      payload: { clientId, clientName: client.name, portal },
    });

    return {
      portal: cred.portal,
      username: cred.username,
      password: plaintext,
    };
  }

  async remove(clientId: string, portal: Portal) {
    const client = await this.assertClientInScope(clientId);
    const cred = await this.prisma.clientCredential.findUnique({
      where: { clientId_portal: { clientId, portal } },
    });
    if (!cred) throw new NotFoundException('Credential not found');

    await this.prisma.clientCredential.delete({ where: { id: cred.id } });
    await this.audit.log({
      action: 'DELETE_CREDENTIAL',
      entityType: 'client_credential',
      entityId: cred.id,
      payload: { clientId, clientName: client.name, portal },
    });
    return { ok: true };
  }
}
