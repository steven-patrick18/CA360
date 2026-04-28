import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { ClsService } from 'nestjs-cls';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const SAFE_USER_FIELDS = {
  id: true,
  firmId: true,
  branchId: true,
  name: true,
  email: true,
  mobile: true,
  role: true,
  isActive: true,
  twoFaEnabled: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function generateTempPassword(): string {
  // 16 url-safe characters; user is forced to reset on first 2FA enrollment.
  return randomBytes(12).toString('base64').replace(/[+/=]/g, '').slice(0, 16) + 'A1!';
}

@Injectable()
export class UsersService {
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

  private currentUserId(): string {
    const id = this.cls.get<string>('userId');
    if (!id) throw new ForbiddenException('No user context');
    return id;
  }

  async findAll() {
    return this.prisma.user.findMany({
      where: { firmId: this.firmId() },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      select: {
        ...SAFE_USER_FIELDS,
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, firmId: this.firmId() },
      select: {
        ...SAFE_USER_FIELDS,
        branch: { select: { id: true, name: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto) {
    const firmId = this.firmId();

    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, firmId },
      });
      if (!branch) throw new NotFoundException('Branch not found');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('A user with this email already exists');

    const tempPassword = dto.password ?? generateTempPassword();
    const passwordHash = await hash(tempPassword);

    const user = await this.prisma.user.create({
      data: {
        firmId,
        branchId: dto.branchId,
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        mobile: dto.mobile,
        role: dto.role,
        passwordHash,
        isActive: true,
        // twoFaEnabled stays false → user enrolls at first login
      },
      select: SAFE_USER_FIELDS,
    });

    await this.audit.log({
      action: 'CREATE',
      entityType: 'user',
      entityId: user.id,
      payload: { email: user.email, role: user.role },
    });

    // Return the temp password only on creation (so it can be shared with the user).
    return {
      ...user,
      tempPassword: dto.password ? undefined : tempPassword,
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    const firmId = this.firmId();
    const existing = await this.findOne(id);

    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, firmId },
      });
      if (!branch) throw new NotFoundException('Branch not found');
    }

    // Sanity guard: don't let someone deactivate themselves accidentally
    if (dto.isActive === false && id === this.currentUserId()) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    // Only Managing Partner can grant another Managing Partner role
    if (dto.role === 'MANAGING_PARTNER' && existing.role !== 'MANAGING_PARTNER') {
      const me = this.cls.get<string>('userRole');
      if (me !== 'MANAGING_PARTNER') {
        throw new ForbiddenException('Only a Managing Partner can grant that role');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        role: dto.role,
        branchId: dto.branchId,
        mobile: dto.mobile,
        isActive: dto.isActive,
      },
      select: SAFE_USER_FIELDS,
    });

    await this.audit.log({
      action: 'UPDATE',
      entityType: 'user',
      entityId: id,
      payload: this.diffUser(existing, updated),
    });

    return updated;
  }

  async resetPassword(id: string) {
    const user = await this.findOne(id);
    const tempPassword = generateTempPassword();
    const passwordHash = await hash(tempPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        twoFaEnabled: false,
        twoFaSecret: null, // force fresh 2FA enrollment after password reset
      },
    });
    await this.audit.log({
      action: 'RESET_PASSWORD',
      entityType: 'user',
      entityId: id,
      payload: { email: user.email },
    });
    return { tempPassword };
  }

  private diffUser(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): Record<string, { from: unknown; to: unknown }> {
    const diff: Record<string, { from: unknown; to: unknown }> = {};
    const fields = ['name', 'role', 'branchId', 'mobile', 'isActive'];
    for (const f of fields) {
      if (before[f] !== after[f]) {
        diff[f] = { from: before[f], to: after[f] };
      }
    }
    return diff;
  }
}

// Used by other modules to silence the unused warning.
export type { Prisma };
