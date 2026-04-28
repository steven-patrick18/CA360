import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { hash, verify as verifyHash } from '@node-rs/argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { Verify2faDto } from './dto/verify-2fa.dto';

interface PreAuthPayload {
  sub: string;
  stage: 'pre_2fa';
}

interface AuthPayload {
  sub: string;
  firmId: string;
  role: string;
  stage: 'authenticated';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await verifyHash(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const needsEnrollment = !user.twoFaEnabled || !user.twoFaSecret;
    let qrDataUrl: string | undefined;
    let manualEntryKey: string | undefined;
    let secret = user.twoFaSecret ?? '';

    if (needsEnrollment) {
      secret = authenticator.generateSecret();
      await this.prisma.user.update({
        where: { id: user.id },
        data: { twoFaSecret: secret, twoFaEnabled: false },
      });
      const issuer = this.config.get<string>('TOTP_ISSUER') ?? 'CA360';
      const otpauth = authenticator.keyuri(user.email, issuer, secret);
      qrDataUrl = await QRCode.toDataURL(otpauth);
      manualEntryKey = secret;
    }

    const preAuthToken = await this.jwt.signAsync(
      { sub: user.id, stage: 'pre_2fa' } satisfies PreAuthPayload,
      { expiresIn: '5m' },
    );

    return {
      stage: needsEnrollment ? 'enroll_2fa' : 'verify_2fa',
      preAuthToken,
      qrDataUrl,
      manualEntryKey,
    };
  }

  async verify2fa(dto: Verify2faDto) {
    let payload: PreAuthPayload;
    try {
      payload = await this.jwt.verifyAsync<PreAuthPayload>(dto.preAuthToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired pre-auth token');
    }
    if (payload.stage !== 'pre_2fa') {
      throw new UnauthorizedException('Invalid token stage');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.twoFaSecret) {
      throw new UnauthorizedException('No 2FA setup for this account');
    }

    // Allow ±1 window (30s clock skew tolerance)
    authenticator.options = { window: 1 };
    const isValid = authenticator.check(dto.code, user.twoFaSecret);
    if (!isValid) throw new UnauthorizedException('Invalid 2FA code');

    if (!user.twoFaEnabled) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { twoFaEnabled: true },
      });
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      firmId: user.firmId,
      role: user.role,
      stage: 'authenticated',
    } satisfies AuthPayload);

    return {
      accessToken,
      user: {
        id: user.id,
        firmId: user.firmId,
        branchId: user.branchId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { firm: true, branch: true },
    });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      firmId: user.firmId,
      firmName: user.firm.name,
      firmLogoDataUrl: user.firm.logoDataUrl,
      branchId: user.branchId,
      branchName: user.branch?.name ?? null,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  // Helper for seed script — never exposed via HTTP.
  static async hashPassword(plain: string): Promise<string> {
    return hash(plain);
  }
}
