import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFirmDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  pan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  registrationNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}
