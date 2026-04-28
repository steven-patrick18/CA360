import { Portal } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpsertCredentialDto {
  @IsEnum(Portal)
  portal!: Portal;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  password!: string;
}
