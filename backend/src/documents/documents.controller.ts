import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  // ── Listing on a client (and optionally narrowed to a filing) ───────
  @Get('clients/:clientId/documents')
  list(
    @Param('clientId', new ParseUUIDPipe()) clientId: string,
    @Query('filingId') filingId?: string,
  ) {
    return this.documents.list(clientId, filingId);
  }

  // ── Upload ──────────────────────────────────────────────────────────
  @Post('clients/:clientId/documents')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }),
  )
  upload(
    @Param('clientId', new ParseUUIDPipe()) clientId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('category') category?: string,
    @Body('filingId') filingId?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded under field "file"');
    return this.documents.upload(clientId, file, { category, filingId });
  }

  // ── Download ────────────────────────────────────────────────────────
  @Get('documents/:id/download')
  async download(@Param('id', new ParseUUIDPipe()) id: string, @Res() res: Response) {
    const { buffer, mime, filename } = await this.documents.download(id);
    res
      .set({
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
        'Content-Length': String(buffer.length),
      })
      .send(buffer);
  }

  // ── Delete ──────────────────────────────────────────────────────────
  @Delete('documents/:id')
  @Roles('MANAGING_PARTNER', 'PARTNER', 'BRANCH_HEAD')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.documents.remove(id);
  }
}
