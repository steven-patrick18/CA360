import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateComputationDto } from './computation-payload.dto';

export class UpdateComputationDto extends PartialType(
  OmitType(CreateComputationDto, ['clientId'] as const),
) {}
