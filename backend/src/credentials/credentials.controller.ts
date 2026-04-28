import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Portal } from '@prisma/client';
import { CredentialsService } from './credentials.service';
import { UpsertCredentialDto } from './dto/upsert-credential.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients/:clientId/credentials')
export class CredentialsController {
  constructor(private readonly creds: CredentialsService) {}

  @Get()
  list(@Param('clientId', new ParseUUIDPipe()) clientId: string) {
    return this.creds.list(clientId);
  }

  @Post()
  @Roles('MANAGING_PARTNER', 'PARTNER', 'BRANCH_HEAD', 'SENIOR_ARTICLE')
  upsert(
    @Param('clientId', new ParseUUIDPipe()) clientId: string,
    @Body() dto: UpsertCredentialDto,
  ) {
    return this.creds.upsert(clientId, dto);
  }

  @Post(':portal/reveal')
  @Roles('MANAGING_PARTNER', 'PARTNER', 'BRANCH_HEAD', 'SENIOR_ARTICLE')
  reveal(
    @Param('clientId', new ParseUUIDPipe()) clientId: string,
    @Param('portal', new ParseEnumPipe(Portal)) portal: Portal,
  ) {
    return this.creds.reveal(clientId, portal);
  }

  @Delete(':portal')
  @Roles('MANAGING_PARTNER', 'PARTNER', 'BRANCH_HEAD')
  remove(
    @Param('clientId', new ParseUUIDPipe()) clientId: string,
    @Param('portal', new ParseEnumPipe(Portal)) portal: Portal,
  ) {
    return this.creds.remove(clientId, portal);
  }
}
