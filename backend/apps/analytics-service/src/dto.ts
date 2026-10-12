import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ALL_EVENT_TYPES, type EventType } from '@app/common';

export class LogsQueryDto {
  @ApiPropertyOptional({ enum: ALL_EVENT_TYPES })
  @IsOptional()
  @IsIn(ALL_EVENT_TYPES)
  type?: EventType;

  @ApiPropertyOptional({ example: 'ingest-service' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  service?: string;

  @ApiPropertyOptional({ description: 'Inclusive lower bound, ISO 8601', example: '2026-01-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Exclusive upper bound, ISO 8601', example: '2026-02-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page?: number;

  @ApiPropertyOptional({ default: 24, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

export class LogDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ALL_EVENT_TYPES }) type!: EventType;
  @ApiProperty() service!: string;
  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' }) timestamp!: string;
  @ApiProperty({ type: 'object', additionalProperties: true }) payload!: Record<string, unknown>;
}

export class LogPageDto {
  @ApiProperty({ type: [LogDto] }) items!: LogDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class ReportQueryDto {
  @ApiPropertyOptional({ description: 'Start, ISO 8601. Default: 24h before `to`', example: '2026-01-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End, ISO 8601. Default: now' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Aggregation bucket in seconds. Default: chosen to give at most 60 points', minimum: 1, maximum: 2_592_000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_592_000)
  bucketSeconds?: number;
}
