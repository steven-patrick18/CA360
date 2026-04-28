import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { TaxRegime } from '@prisma/client';

export class ListComputationsQueryDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsString()
  assessmentYear?: string;

  @IsOptional()
  @IsEnum(TaxRegime)
  regime?: TaxRegime;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @Transform(({ value }) => (value === undefined || value === null ? 50 : value))
  limit: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Transform(({ value }) => (value === undefined || value === null ? 0 : value))
  offset: number = 0;
}
