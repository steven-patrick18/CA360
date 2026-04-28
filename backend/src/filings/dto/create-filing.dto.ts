import { FilingStatus, ItrForm } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const AY_REGEX = /^(\d{4})-(\d{2})$/;

export class CreateFilingDto {
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

  @IsOptional()
  @IsEnum(ItrForm)
  itrForm?: ItrForm;

  @IsOptional()
  @IsEnum(FilingStatus)
  status?: FilingStatus;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  filedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  acknowledgementNo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  grossIncome?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxPaid?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  refundAmount?: number;

  @IsOptional()
  @IsUUID()
  preparedById?: string;

  @IsOptional()
  @IsUUID()
  filedById?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;
}
