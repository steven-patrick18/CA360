import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FirmsService } from './firms.service';
import { UpdateFirmDto } from './dto/update-firm.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('firms')
export class FirmsController {
  constructor(private readonly firms: FirmsService) {}

  // Anyone in the firm can read these — they're shown in the header / login screen.
  @Get('me')
  me() {
    return this.firms.getMine();
  }

  @Patch('me')
  @Roles('MANAGING_PARTNER')
  update(@Body() dto: UpdateFirmDto) {
    return this.firms.update(dto);
  }

  @Post('me/logo')
  @Roles('MANAGING_PARTNER')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 1 * 1024 * 1024 } }))
  uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded under field "file"');
    return this.firms.uploadLogo(file);
  }

  @Delete('me/logo')
  @Roles('MANAGING_PARTNER')
  clearLogo() {
    return this.firms.clearLogo();
  }
}
