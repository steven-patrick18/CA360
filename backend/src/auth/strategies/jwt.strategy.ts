import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  firmId: string;
  role: UserRole;
  stage: 'pre_2fa' | 'authenticated';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly cls: ClsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'unsafe-dev-only',
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (payload.stage !== 'authenticated') {
      throw new UnauthorizedException('Authentication incomplete');
    }
    // Populate request-scoped context so services can read firmId / userId / role
    // without threading them through every method signature.
    this.cls.set('firmId', payload.firmId);
    this.cls.set('userId', payload.sub);
    this.cls.set('userRole', payload.role);
    return payload;
  }
}
