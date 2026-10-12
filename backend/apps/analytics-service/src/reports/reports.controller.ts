import { BadGatewayException, BadRequestException, Controller, Get, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportQueryDto } from '../dto';
import { ReportService } from './report.service';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportService) {}

  @Get('pdf')
  @ApiOperation({
    summary: 'PDF report with charts of event activity from RedisTimeSeries',
    description: 'Queries the time series, then renders the PDF in the Go report-service over gRPC.',
  })
  @ApiProduces('application/pdf')
  @ApiOkResponse({ description: 'The PDF document', schema: { type: 'string', format: 'binary' } })
  async pdf(@Query() query: ReportQueryDto, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const from = query.from ? Date.parse(query.from) : undefined;
    const to = query.to ? Date.parse(query.to) : undefined;
    if (from !== undefined && to !== undefined && from > to) throw new BadRequestException('"from" must not be after "to"');

    let pdf;
    try {
      pdf = await this.reports.generate({
        ...(from !== undefined ? { from } : {}),
        ...(to !== undefined ? { to } : {}),
        ...(query.bucketSeconds ? { bucketMs: query.bucketSeconds * 1000 } : {}),
      });
    } catch (err) {
      throw new BadGatewayException(`Report generation failed: ${(err as Error).message}`);
    }
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${pdf.filename}"` });
    return new StreamableFile(pdf.data);
  }
}
