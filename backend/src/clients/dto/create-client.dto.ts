import { ClientType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR_LAST4_REGEX = /^[0-9]{4}$/;

export class CreateClientDto {
  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fatherName?: string;

  @IsOptional()
  @IsString()
  @Length(10, 10)
  @Matches(PAN_REGEX, { message: 'PAN must be 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  pan?: string;

  /**
   * Last 4 digits of Aadhaar only — we never store the full number.
   * The DB persists "XXXX-XXXX-NNNN" for display.
   */
  @IsOptional()
  @IsString()
  @Matches(AADHAAR_LAST4_REGEX, { message: 'Provide only the last 4 digits of Aadhaar' })
  aadhaarLast4?: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsEnum(ClientType)
  @Type(() => String)
  typeOfAssessee: ClientType = ClientType.INDIVIDUAL;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
