import { AgeCategory, TaxRegime } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

const AY_REGEX = /^(\d{4})-(\d{2})$/;

/**
 * Wire shape for `inputs` and `computed` blobs. They're stored as JSONB so we
 * keep the schema flexible across years; we validate the outer envelope here
 * but trust the calculator (frontend) to keep the inner shape consistent.
 */
export class ComputationInputsDto {
  [key: string]: unknown;
}

export class ComputationComputedDto {
  [key: string]: unknown;
}

export class CreateComputationDto {
  @IsUUID()
  clientId!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(AY_REGEX, { message: 'Assessment year must be in format YYYY-YY (e.g., 2024-25)' })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    const m = AY_REGEX.exec(trimmed);
    if (!m) return trimmed;
    const start = parseInt(m[1], 10);
    const end = parseInt(m[2], 10);
    const expectedEnd = (start + 1) % 100;
    return end === expectedEnd ? trimmed : `INVALID:${trimmed}`;
  })
  assessmentYear!: string;

  @IsEnum(TaxRegime)
  regime!: TaxRegime;

  @IsOptional()
  @IsEnum(AgeCategory)
  ageCategory?: AgeCategory;

  @IsObject()
  @IsNotEmptyObject()
  @Type(() => ComputationInputsDto)
  inputs!: ComputationInputsDto;

  @IsObject()
  @IsNotEmptyObject()
  @Type(() => ComputationComputedDto)
  computed!: ComputationComputedDto;

  @IsOptional()
  @Type(() => Number)
  taxPayable?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;
}
