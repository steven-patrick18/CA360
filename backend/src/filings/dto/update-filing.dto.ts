import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateFilingDto } from './create-filing.dto';

// On update, clientId is fixed (filing belongs to one client).
export class UpdateFilingDto extends PartialType(OmitType(CreateFilingDto, ['clientId'] as const)) {}
