import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { normalizePage } from '@app/common';
import { LogPageDto, LogsQueryDto } from '../dto';
import { LogsRepository } from './logs.repository';

@ApiTags('logs')
@Controller('logs')
export class LogsController {
  constructor(private readonly logs: LogsRepository) {}

  @Get()
  @ApiOperation({ summary: 'Query stored event logs, newest first' })
  @ApiOkResponse({ type: LogPageDto })
  async query(@Query() query: LogsQueryDto): Promise<LogPageDto> {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from > to) throw new BadRequestException('"from" must not be after "to"');

    const { page, pageSize } = normalizePage(query.page, query.pageSize);
    const result = await this.logs.query(
      { ...(query.type ? { type: query.type } : {}), ...(query.service ? { service: query.service } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) },
      page,
      pageSize,
    );
    return {
      items: result.items.map((l) => ({
        id: l.eventId,
        type: l.type,
        service: l.service,
        timestamp: l.timestamp.toISOString(),
        payload: { ...l.payload },
      })),
      total: result.total,
      page,
      pageSize,
    };
  }
}
