import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
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

  /**
   * Import an ITR JSON file (downloaded by the user from the IT Department's
   * e-Filing portal) and create / update the matching filing record. Same
   * roles that can create a filing manually can also import.
   */
  @Post('import/:clientId')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // ITR JSONs are typically <500 KB
    }),
  )
  importFromJson(
    @Param('clientId', new ParseUUIDPipe()) clientId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded under field "file"');
    if (!file.originalname.match(/\.json$/i)) {
      throw new BadRequestException('Please upload the ITR JSON file (.json)');
    }
    return this.filings.importFromJson(clientId, file.buffer, file.originalname);
  }

  /**
   * Download the original uploaded ITR JSON for a filing. 404 if no JSON was
   * ever imported for this filing (e.g. it was created manually).
   */
  @Get(':id/source-json')
  async downloadSourceJson(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    const src = await this.filings.getSourceJson(id);
    if (!src) {
      throw new NotFoundException(
        'No ITR JSON has been imported for this filing yet — nothing to download.',
      );
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${src.filename.replace(/"/g, '')}"`,
    );
    res.send(src.json);
  }
}
