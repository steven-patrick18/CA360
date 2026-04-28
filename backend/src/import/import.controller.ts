import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportService } from './import.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MANAGING_PARTNER', 'PARTNER', 'BRANCH_HEAD')
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('clients')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  async importClients(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded under field "file"');
    if (!file.originalname.match(/\.(xlsx|xls)$/i)) {
      throw new BadRequestException('Only .xlsx or .xls files are accepted');
    }
    return this.importService.importClients(file.buffer);
  }
}
