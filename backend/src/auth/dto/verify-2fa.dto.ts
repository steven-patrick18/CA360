import { IsNotEmpty, IsString, Length } from 'class-validator';

export class Verify2faDto {
  @IsString()
  @IsNotEmpty()
  preAuthToken!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
