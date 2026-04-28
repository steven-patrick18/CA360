import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FilingsService } from './filings.service';
import { CreateFilingDto } from './dto/create-filing.dto';
import { UpdateFilingDto } from './dto/update-filing.dto';
import { ListFilingsQueryDto } from './dto/list-filings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('filings')
export class FilingsController {
  constructor(private readonly filings: FilingsService) {}

  @Get()
  list(@Query() query: ListFilingsQueryDto) {
    return this.filings.findAll(query);
  }

  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.filings.findOne(id);
  }

  @Post()
  // Filings are part of routine data entry — every role with client visibility
  // can create one (the service further enforces that the client is in their
  // scope, so Articles can only create filings for their assigned clients).
  create(@Body() dto: CreateFilingDto) {
    return this.filings.create(dto);
  }

  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateFilingDto) {
    return this.filings.update(id, dto);
  }

  @Delete(':id')
  @Roles('MANAGING_PARTNER', 'PARTNER', 'BRANCH_HEAD')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.filings.remove(id);
  }
}
