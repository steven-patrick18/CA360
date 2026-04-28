import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { hash, verify as verifyHash } from '@node-rs/argon2';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly audit: AuditService,
  ) {}

  private userId(): string {
    const id = this.cls.get<string>('userId');
    if (!id) throw new ForbiddenException('No user context');
    return id;
  }

  async me() {
    const user = await this.prisma.user.findUnique({
      where: { id: this.userId() },
      include: { firm: true, branch: true },
    });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      firmId: user.firmId,
      firmName: user.firm.name,
      branchId: user.branchId,
      branchName: user.branch?.name ?? null,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      twoFaEnabled: user.twoFaEnabled,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(dto: UpdateProfileDto) {
    const userId = this.userId();
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name?.trim(),
        mobile: dto.mobile?.trim(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        role: true,
      },
    });
    await this.audit.log({
      action: 'UPDATE_PROFILE',
      entityType: 'user',
      entityId: userId,
      payload: { fields: Object.keys(dto) },
    });
    return updated;
  }

  async changePassword(dto: ChangePasswordDto) {
    const userId = this.userId();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const ok = await verifyHash(user.passwordHash, dto.currentPassword);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must differ from current password');
    }

    const newHash = await hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });
    await this.audit.log({
      action: 'CHANGE_PASSWORD',
      entityType: 'user',
      entityId: userId,
    });

    return { ok: true };
  }
}
