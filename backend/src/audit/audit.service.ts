import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEvent {
  action: string;
  entityType: string;
  entityId?: string;
  payload?: Record<string, unknown>;
  /** Override firmId if not in CLS (e.g. during login flow). */
  firmId?: string;
  /** Override userId if not in CLS (e.g. for system events). */
  userId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async log(event: AuditEvent): Promise<void> {
    const firmId = event.firmId ?? this.cls.get<string>('firmId');
    const userId = event.userId ?? this.cls.get<string>('userId');
    const ip = this.cls.get<string>('ip') ?? null;
    const userAgent = this.cls.get<string>('userAgent') ?? null;

    if (!firmId) {
      // Without a firmId we can't attach the row — skip rather than fail the
      // user's request. Surface in logs so we notice misconfiguration.
      this.logger.warn(`audit skipped (no firmId): ${event.action} ${event.entityType}`);
      return;
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          firmId,
          userId: userId ?? null,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId ?? null,
          ipAddress: ip,
          userAgent,
          payloadJson: event.payload ? (event.payload as object) : undefined,
        },
      });
    } catch (err) {
      this.logger.error(
        `audit write failed for ${event.action} ${event.entityType}: ${(err as Error).message}`,
      );
    }
  }
}
