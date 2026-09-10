import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  @MaxLength(120)
  merchant!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsDateString()
  incurredAt!: string;
}

export class PrepareReceiptUploadDto {
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsIn(['image/jpeg', 'image/png', 'application/pdf'])
  contentType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  sizeBytes!: number;
}

export class CompleteReceiptUploadDto {
  @IsString()
  @MaxLength(1000)
  objectKey!: string;
}

export class ListExpensesQuery {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 20;
}
