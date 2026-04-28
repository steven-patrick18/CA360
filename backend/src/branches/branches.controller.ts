import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MANAGING_PARTNER', 'PARTNER')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  list() {
    return this.branches.findAll();
  }

  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.branches.findOne(id);
  }

  @Post()
  @Roles('MANAGING_PARTNER')
  create(@Body() dto: CreateBranchDto) {
    return this.branches.create(dto);
  }

  @Patch(':id')
  @Roles('MANAGING_PARTNER')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateBranchDto) {
    return this.branches.update(id, dto);
  }

  @Delete(':id')
  @Roles('MANAGING_PARTNER')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.branches.remove(id);
  }
}
