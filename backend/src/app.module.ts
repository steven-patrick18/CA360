import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EncryptionModule } from './encryption/encryption.module';
import { AuditModule } from './audit/audit.module';
import { ClientsModule } from './clients/clients.module';
import { CredentialsModule } from './credentials/credentials.module';
import { FilingsModule } from './filings/filings.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { MetaModule } from './meta/meta.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        setup: (cls, req: { ip?: string; headers?: Record<string, string | string[] | undefined> }) => {
          // Captured at request-start so audit logs include source info
          // even if the handler throws partway through.
          const xff = req.headers?.['x-forwarded-for'];
          const xffStr = Array.isArray(xff) ? xff[0] : xff;
          cls.set('ip', req.ip ?? xffStr ?? null);
          const ua = req.headers?.['user-agent'];
          const uaStr = Array.isArray(ua) ? ua[0] : ua;
          cls.set('userAgent', uaStr ?? null);
        },
      },
    }),
    PrismaModule,
    EncryptionModule,
    AuditModule,
    AuthModule,
    ClientsModule,
    CredentialsModule,
    FilingsModule,
    DashboardModule,
    MetaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
