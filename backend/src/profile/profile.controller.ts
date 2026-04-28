import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('me')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  me() {
    return this.profile.me();
  }

  @Patch()
  updateProfile(@Body() dto: UpdateProfileDto) {
    return this.profile.updateProfile(dto);
  }

  @Post('change-password')
  changePassword(@Body() dto: ChangePasswordDto) {
    return this.profile.changePassword(dto);
  }
}
