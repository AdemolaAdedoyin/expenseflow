import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class CreateExpenseDto {
  @IsString() @MaxLength(120) merchant!: string;
  @Type(() => Number) @IsInt() @Min(1) amountCents!: number;
  @IsOptional() @IsString() currency?: string;
  @IsString() category!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) receiptUrl?: string;
  @IsDateString() incurredAt!: string;
}

export class ListExpensesQuery {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit = 20;
}
