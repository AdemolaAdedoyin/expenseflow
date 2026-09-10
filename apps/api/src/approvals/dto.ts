import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
export class DecideApprovalDto {
  @IsIn(['APPROVE','REJECT']) decision!: 'APPROVE'|'REJECT';
  @IsOptional() @IsString() @MaxLength(500) comment?: string;
}
