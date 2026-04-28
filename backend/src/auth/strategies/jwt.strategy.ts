import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  firmId: string;
  role: string;
  stage: 'pre_2fa' | 'authenticated';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'unsafe-dev-only',
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    // Pre-auth tokens (between password + 2FA) cannot access protected routes.
    if (payload.stage !== 'authenticated') {
      throw new UnauthorizedException('Authentication incomplete');
    }
    return payload;
  }
}
