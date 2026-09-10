import { PolicyAction } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePolicyDto {
  @IsString() name!: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsInt() @Min(0) minAmountCents?: number;
  @IsOptional() @IsInt() @Min(0) maxAmountCents?: number;
  @IsEnum(PolicyAction) action!: PolicyAction;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
