import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class SearchQueryDto {
  @ApiPropertyOptional({ description: 'Words to match as prefixes, all required', example: 'red lip' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ description: 'Zero-based page', default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page (max 100)', default: 24, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

export class FetchQueryDto {
  @ApiPropertyOptional({ description: 'Also load the downloaded data into Mongo', default: false })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsBoolean()
  import?: boolean;
}

export class ProductDto {
  @ApiProperty() id!: number;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty() category!: string;
  @ApiPropertyOptional() brand?: string;
  @ApiProperty() price!: number;
  @ApiProperty() thumbnail!: string;
  @ApiProperty({ type: [String] }) images!: string[];
}

export class ProductPageDto {
  @ApiProperty({ type: [ProductDto] }) items!: ProductDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class FileUploadDto {
  @ApiProperty({ type: 'string', format: 'binary', description: '.json (array or { products: [] }) or .xlsx (header row + data)' })
  file!: unknown;
}
