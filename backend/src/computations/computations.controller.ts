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
import { ComputationsService } from './computations.service';
import { CreateComputationDto } from './dto/computation-payload.dto';
import { UpdateComputationDto } from './dto/update-computation.dto';
import { ListComputationsQueryDto } from './dto/list-computations.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('computations')
export class ComputationsController {
  constructor(private readonly computations: ComputationsService) {}

  @Get()
  list(@Query() query: ListComputationsQueryDto) {
    return this.computations.findAll(query);
  }

  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.computations.findOne(id);
  }

  @Post()
  // Same access surface as Filings — every role with client scope can save a
  // computation for the clients they're allowed to see.
  create(@Body() dto: CreateComputationDto) {
    return this.computations.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateComputationDto,
  ) {
    return this.computations.update(id, dto);
  }

  @Delete(':id')
  @Roles('MANAGING_PARTNER', 'PARTNER', 'BRANCH_HEAD')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.computations.remove(id);
  }
}
